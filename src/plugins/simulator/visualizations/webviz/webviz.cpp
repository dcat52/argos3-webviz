/**
 * @file <argos3/plugins/simulator/visualizations/webviz/webviz.cpp>
 *
 * @author Prajankya Sonar - <prajankya@gmail.com>
 *
 * @project ARGoS3-Webviz <https://github.com/NESTlab/argos3-webviz>
 *
 * MIT License
 * Copyright (c) 2020 NEST Lab
 */

#include "webviz.h"
#include "webviz_draw_functions.h"

#include <unordered_map>
#include <unordered_set>
#include <sstream>

/* Entity includes for programmatic construction */
#include <argos3/plugins/simulator/entities/box_entity.h>
#include <argos3/plugins/simulator/entities/cylinder_entity.h>
#include <argos3/plugins/robots/foot-bot/simulator/footbot_entity.h>
#include <argos3/core/simulator/entity/embodied_entity.h>
#include <argos3/core/utility/math/rng.h>

/* Optional robot includes — may not be installed */
#if __has_include(<argos3/plugins/robots/kheperaiv/simulator/kheperaiv_entity.h>)
#include <argos3/plugins/robots/kheperaiv/simulator/kheperaiv_entity.h>
#define WEBVIZ_HAS_KHEPERAIV 1
#endif

namespace argos {

  /****************************************/
  /****************************************/

  CWebviz::CWebviz()
      : m_eExperimentState(Webviz::EExperimentState::EXPERIMENT_INITIALIZED),
        m_cTimer(),
        m_cSpace(m_cSimulator.GetSpace()),
        m_bFastForwarding(false) {}

  /****************************************/
  /****************************************/

  // cppcheck-suppress unusedFunction
  void CWebviz::Init(TConfigurationNode& t_tree) {
    unsigned short unPort;
    unsigned short unBroadcastFrequency;

    std::string strKeyFilePath;
    std::string strCertFilePath;
    std::string strDHParamsFilePath;
    std::string strCAFilePath;
    std::string strCertPassphrase;

    /* Parse options from the XML */
    GetNodeAttributeOrDefault(t_tree, "port", unPort, UInt16(3000));
    GetNodeAttributeOrDefault(
      t_tree, "broadcast_frequency", unBroadcastFrequency, UInt16(10));
    GetNodeAttributeOrDefault(
      t_tree, "ff_draw_frames_every", m_unDrawFrameEvery, UInt16(2));
    GetNodeAttributeOrDefault(
      t_tree, "delta", m_bDeltaMode, false);
    GetNodeAttributeOrDefault(
      t_tree, "keyframe_interval", m_unKeyframeInterval, UInt32(100));
    GetNodeAttributeOrDefault(
      t_tree, "extended_state", m_bExtendedState, false);
    GetNodeAttributeOrDefault(
      t_tree, "real_time_factor", m_fRealTimeFactor, Real(1.0));

    /* User data filtering options */
    GetNodeAttributeOrDefault(
      t_tree, "send_entity_data", m_bSendEntityData, true);
    GetNodeAttributeOrDefault(
      t_tree, "send_global_data", m_bSendGlobalData, true);
    std::string strEntityDataFields;
    GetNodeAttributeOrDefault(
      t_tree, "entity_data_fields", strEntityDataFields, std::string(""));
    if (!strEntityDataFields.empty()) {
      std::istringstream ss(strEntityDataFields);
      std::string field;
      while (std::getline(ss, field, ',')) {
        /* Trim whitespace */
        size_t start = field.find_first_not_of(" ");
        size_t end = field.find_last_not_of(" ");
        if (start != std::string::npos)
          m_setEntityDataFields.insert(field.substr(start, end - start + 1));
      }
    }

    /* Get options for ssl certificate from XML */
    GetNodeAttributeOrDefault(
      t_tree, "ssl_key_file", strKeyFilePath, std::string(""));
    GetNodeAttributeOrDefault(
      t_tree, "ssl_cert_file", strCertFilePath, std::string(""));
    GetNodeAttributeOrDefault(
      t_tree, "ssl_dh_params_file", strDHParamsFilePath, std::string(""));
    GetNodeAttributeOrDefault(
      t_tree, "ssl_ca_file", strCAFilePath, std::string(""));
    GetNodeAttributeOrDefault(
      t_tree, "ssl_cert_passphrase", strCertPassphrase, std::string(""));

    /* check parameters  */
    if (unPort < 1 || 65535 < unPort) {
      throw CARGoSException(
        "\"Port number\" set in configuration is out of range [1,65535]");
    }

    if (unBroadcastFrequency < 1 || 1000 < unBroadcastFrequency) {
      throw CARGoSException(
        "Broadcast frequency set in configuration is out of range [1,1000]");
    }

    if (m_unDrawFrameEvery < 1 || 1000 < m_unDrawFrameEvery) {
      throw CARGoSException(
        "Broadcast frequency set in configuration is invalid ( < 1 )");
    }

    /* Parse XML for user functions */
    if (NodeExists(t_tree, "user_functions")) {
      /* Use the passed user functions */
      /* Get data from XML */
      TConfigurationNode tNode = GetNode(t_tree, "user_functions");
      std::string strLabel, strLibrary;
      GetNodeAttribute(tNode, "label", strLabel);
      GetNodeAttributeOrDefault(tNode, "library", strLibrary, strLibrary);
      try {
        /* Load the library */
        if (strLibrary != "") {
          CDynamicLoading::LoadLibrary(strLibrary);
        }
        /* Create the user functions */
        m_pcUserFunctions = CFactory<CWebvizUserFunctions>::New(strLabel);

        /* Initialize user functions */
        m_pcUserFunctions->Init(tNode);

      } catch (CARGoSException& ex) {
        THROW_ARGOSEXCEPTION_NESTED(
          "Failed opening Webviz user function library", ex);
      }
    } else {
      /* Use standard (empty) user functions */
      m_pcUserFunctions = new CWebvizUserFunctions;
    }

    /* Check if port is available to bind */
    if (!PortChecker::CheckPortTCPisAvailable(unPort)) {
      THROW_ARGOSEXCEPTION("Port " + std::to_string(unPort) + " already in use")
      return;
    }

    /* Initialize Webserver */
    m_cWebServer = new Webviz::CWebServer(
      this,
      unPort,
      unBroadcastFrequency,
      strKeyFilePath,
      strCertFilePath,
      strDHParamsFilePath,
      strCAFilePath,
      strCertPassphrase);

    /* Should we play instantly? */
    bool bAutoPlay = false;
    GetNodeAttributeOrDefault(t_tree, "autoplay", bAutoPlay, bAutoPlay);
    if (bAutoPlay) {
      PlayExperiment();
    }
  }

  /****************************************/
  /****************************************/

  // cppcheck-suppress unusedFunction
  void CWebviz::Execute() {
    /* To manage all threads to exit gracefully */
    std::atomic<bool> bIsServerRunning{true};

    /* Start this->Simulation Thread */
    std::thread tSimulationTread(
      [&]() { this->SimulationThreadFunction(std::ref(bIsServerRunning)); });

    /* Start WebServer */
    m_cWebServer->Start(std::ref(bIsServerRunning));  // blocking the thread

    /* Join the simulation thread */
    tSimulationTread.join();

    /* Cleanup */
    LOG.Flush();
    LOGERR.Flush();
  }

  /* main simulation thread fuction */
  void CWebviz::SimulationThreadFunction(
    const std::atomic<bool>& b_IsServerRunning) {
    /* Set up thread-safe buffers for this new thread */
    LOG.AddThreadSafeBuffer();
    LOGERR.AddThreadSafeBuffer();

    while (b_IsServerRunning) {
      if (
        m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_PLAYING ||
        m_eExperimentState ==
          Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING) {
        /* Fast forward steps counter used inside */
        int unFFStepCounter;

        if (m_bFastForwarding) {
          /* Number of frames to drop in fast-forward */
          unFFStepCounter = m_unDrawFrameEvery;
        } else {
          /* For non-fastforwarding mode, steps is 1 */
          unFFStepCounter = 1;
        }

        /* Drain queued commands before stepping */
        DrainCommandQueue();

        /* Loop for steps (multiple for fast-forward) */
        while (unFFStepCounter > 0 &&  // FF counter
               !m_cSimulator
                  .IsExperimentFinished() &&  // experiment was already finished
               b_IsServerRunning &&    // to stop if whole server is stopped
               (m_eExperimentState ==  // Check if we are in right state
                  Webviz::EExperimentState::EXPERIMENT_PLAYING ||
                m_eExperimentState ==
                  Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING)) {
          /* Run one step */
          m_cSimulator.UpdateSpace();

          /* Steps counter in this while loop */
          --unFFStepCounter;
        }

        /* Broadcast current experiment state */
        BroadcastExperimentState();

        /* Experiment done while in while loop */
        if (m_cSimulator.IsExperimentFinished()) {
          LOG << "[INFO] Experiment done" << '\n';

          /* The experiment is done */
          m_cSimulator.GetLoopFunctions().PostExperiment();

          /* Disable fast-forward */
          m_bFastForwarding = false;

          /* Set Experiment state to Done */
          m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_DONE;

          /* Change state and emit signals */
          m_cWebServer->EmitEvent("Experiment done", m_eExperimentState);
        }

        /* Take the time now */
        m_cTimer.Stop();

        /* If the elapsed time is lower than the tick length, wait */
        if (!m_bFastForwarding && m_fRealTimeFactor > 0) {
          auto cTargetMillis = std::chrono::milliseconds(
            static_cast<long long>(m_cSimulatorTickMillis.count() / m_fRealTimeFactor));
          if (m_cTimer.Elapsed() < cTargetMillis) {
            /* Sleep for the difference duration */
            std::this_thread::sleep_for(cTargetMillis - m_cTimer.Elapsed());
          } else {
            LOGERR << "[WARNING] Clock tick took " << m_cTimer
                   << " milli-secs, more than the expected "
                   << cTargetMillis.count() << " milli-secs. "
                   << "Recovering in next cycle." << '\n';
          }
        }

        /* Restart Timer */
        m_cTimer.Start();
      } else {
        /*
         * Update the experiment state variable and sleep for some time,
         * we sleep to reduce the number of updates done in
         * "PAUSED"/"INITIALIZED"/"DONE" state
         */
        DrainCommandQueue();
        BroadcastExperimentState();
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
      }
    }
    /* do any cleanups */
  }

  /****************************************/
  /****************************************/

  void CWebviz::HandleCommandFromClient(
    const std::string& str_ip, nlohmann::json c_json_command) {
    if (c_json_command.contains("command")) {
      /* Try to get Command key from the JSON */
      std::string strCmd = c_json_command["command"].get<std::string>();

      /* Dispatch commands */
      if (strCmd.compare("play") == 0) {
        PlayExperiment();

      } else if (strCmd.compare("pause") == 0) {
        PauseExperiment();

      } else if (strCmd.compare("step") == 0) {
        StepExperiment();

      } else if (strCmd.compare("reset") == 0) {
        ResetExperiment();

      } else if (strCmd.compare("terminate") == 0) {
        TerminateExperiment();

      } else if (strCmd.compare("fastforward") == 0) {
        try {
          /* number of Steps defined */
          int16_t unSteps = c_json_command["steps"].get<int16_t>();

          /* Validate steps */
          if (1 <= unSteps && unSteps <= 1000) {
            FastForwardExperiment(unSteps);
          } else {
            /* Fastforward without steps defined */
            FastForwardExperiment();
          }

        } catch (const std::exception& _ignored) {
          /* No steps defined */
          FastForwardExperiment();
        }

      } else if (strCmd.compare("speed") == 0) {
        try {
          Real fFactor = c_json_command["factor"].get<Real>();
          if (fFactor > 0 && fFactor <= 1000) {
            m_fRealTimeFactor = fFactor;
            LOG << "[INFO] Real-time factor set to " << fFactor << '\n';
          }
        } catch (const std::exception& _ignored) {}

      } else if (strCmd.compare("moveEntity") == 0) {
        try {
          CVector3 cNewPos;
          CQuaternion cNewOrientation;

          /* Parse Position */
          cNewPos.SetX(c_json_command["position"]["x"].get<float_t>());
          cNewPos.SetY(c_json_command["position"]["y"].get<float_t>());
          cNewPos.SetZ(c_json_command["position"]["z"].get<float_t>());

          /* Parse Orientation */
          cNewOrientation.SetX(
            c_json_command["orientation"]["x"].get<float_t>());
          cNewOrientation.SetY(
            c_json_command["orientation"]["y"].get<float_t>());
          cNewOrientation.SetZ(
            c_json_command["orientation"]["z"].get<float_t>());
          cNewOrientation.SetW(
            c_json_command["orientation"]["w"].get<float_t>());

          EnqueueCommand([this,
                          strId = c_json_command["entity_id"].get<std::string>(),
                          cNewPos, cNewOrientation]() {
            MoveEntity(strId, cNewPos, cNewOrientation);
          });

        } catch (const std::exception& e) {
          LOGERR << "[ERROR] In function MoveEntity: " << e.what() << '\n';
        }

      } else if (strCmd.compare("addEntity") == 0) {
        try {
          std::string strType = c_json_command["type"].get<std::string>();
          std::string strPrefix = c_json_command.value("id_prefix", strType);
          CVector3 cPos;
          cPos.SetX(c_json_command["position"]["x"].get<float_t>());
          cPos.SetY(c_json_command["position"]["y"].get<float_t>());
          cPos.SetZ(c_json_command["position"]["z"].get<float_t>());
          CQuaternion cOrient;
          if (c_json_command.contains("orientation")) {
            cOrient.SetX(c_json_command["orientation"]["x"].get<float_t>());
            cOrient.SetY(c_json_command["orientation"]["y"].get<float_t>());
            cOrient.SetZ(c_json_command["orientation"]["z"].get<float_t>());
            cOrient.SetW(c_json_command["orientation"]["w"].get<float_t>());
          }

          EnqueueCommand([this, strType, strPrefix, cPos, cOrient,
                          cmd = c_json_command]() {
            std::string strId = GenerateEntityId(strPrefix);
            CEntity* pcEntity = nullptr;
            try {
              if (strType == "box") {
                CVector3 cSize(
                  cmd.value("/size/x"_json_pointer, 0.3),
                  cmd.value("/size/y"_json_pointer, 0.3),
                  cmd.value("/size/z"_json_pointer, 0.3));
                bool bMovable = cmd.value("movable", true);
                Real fMass = cmd.value("mass", 1.0);
                pcEntity = new CBoxEntity(
                  strId, cPos, cOrient, bMovable, cSize, fMass);
              } else if (strType == "cylinder") {
                Real fRadius = cmd.value("radius", 0.15);
                Real fHeight = cmd.value("height", 0.5);
                bool bMovable = cmd.value("movable", true);
                Real fMass = cmd.value("mass", 1.0);
                pcEntity = new CCylinderEntity(
                  strId, cPos, cOrient, bMovable, fRadius, fHeight, fMass);
              } else if (strType == "foot-bot") {
                std::string strCtrl = cmd["controller"].get<std::string>();
                pcEntity = new CFootBotEntity(strId, strCtrl, cPos, cOrient);
              } else if (strType == "kheperaiv") {
#ifdef WEBVIZ_HAS_KHEPERAIV
                std::string strCtrl = cmd["controller"].get<std::string>();
                pcEntity = new CKheperaIVEntity(strId, strCtrl, cPos, cOrient);
#else
                LOGERR << "[ERROR] kheperaiv not available in this build\n";
                return;
#endif
              } else {
                LOGERR << "[ERROR] Unknown entity type: " << strType << '\n';
                return;
              }
              m_cSimulator.GetLoopFunctions().AddEntity(*pcEntity);
              LOG << "[INFO] Entity added: " << strId << '\n';
            } catch (CARGoSException& ex) {
              LOGERR << "[ERROR] Failed to add entity " << strId << ": "
                     << ex.what() << '\n';
              delete pcEntity;
            }
          });
        } catch (const std::exception& e) {
          LOGERR << "[ERROR] addEntity: " << e.what() << '\n';
        }

      } else if (strCmd.compare("removeEntity") == 0) {
        try {
          std::string strId = c_json_command["entity_id"].get<std::string>();
          EnqueueCommand([this, strId]() {
            try {
              m_cSimulator.GetLoopFunctions().RemoveEntity(strId);
              LOG << "[INFO] Entity removed: " << strId << '\n';
            } catch (CARGoSException& ex) {
              LOGERR << "[ERROR] Failed to remove entity " << strId << ": "
                     << ex.what() << '\n';
            }
          });
        } catch (const std::exception& e) {
          LOGERR << "[ERROR] removeEntity: " << e.what() << '\n';
        }

      } else if (strCmd.compare("distribute") == 0) {
        try {
          std::string strType = c_json_command["type"].get<std::string>();
          std::string strPrefix = c_json_command.value("id_prefix", strType);
          UInt32 unQuantity = c_json_command["quantity"].get<UInt32>();
          UInt32 unMaxTrials = c_json_command.value("max_trials", 100u);
          auto cmd = c_json_command;

          EnqueueCommand([this, strType, strPrefix, unQuantity, unMaxTrials, cmd]() {
            UInt32 unPlaced = 0;
            std::vector<std::string> vecPlacedIds;
            CRandom::CRNG* pcRNG = CRandom::CreateRNG("argos");

            for (UInt32 i = 0; i < unQuantity; ++i) {
              bool bPlaced = false;
              for (UInt32 t = 0; t < unMaxTrials && !bPlaced; ++t) {
                /* Generate position based on method */
                CVector3 cPos;
                std::string strMethod = cmd.value("position_method", "uniform");
                auto& params = cmd["position_params"];
                if (strMethod == "uniform") {
                  cPos.SetX(pcRNG->Uniform(CRange<Real>(
                    params.value("/min/x"_json_pointer, -2.0),
                    params.value("/max/x"_json_pointer, 2.0))));
                  cPos.SetY(pcRNG->Uniform(CRange<Real>(
                    params.value("/min/y"_json_pointer, -2.0),
                    params.value("/max/y"_json_pointer, 2.0))));
                  cPos.SetZ(params.value("/min/z"_json_pointer, 0.0));
                } else if (strMethod == "gaussian") {
                  cPos.SetX(pcRNG->Gaussian(
                    params.value("/std_dev/x"_json_pointer, 1.0),
                    params.value("/mean/x"_json_pointer, 0.0)));
                  cPos.SetY(pcRNG->Gaussian(
                    params.value("/std_dev/y"_json_pointer, 1.0),
                    params.value("/mean/y"_json_pointer, 0.0)));
                  cPos.SetZ(params.value("/mean/z"_json_pointer, 0.0));
                } else if (strMethod == "grid") {
                  UInt32 cols = params.value("/layout/0"_json_pointer, unQuantity);
                  UInt32 rows = params.value("/layout/1"_json_pointer, 1u);
                  Real cx = params.value("/center/x"_json_pointer, 0.0);
                  Real cy = params.value("/center/y"_json_pointer, 0.0);
                  Real dx = params.value("/distances/x"_json_pointer, 0.5);
                  Real dy = params.value("/distances/y"_json_pointer, 0.5);
                  UInt32 c = i % cols, r = (i / cols) % rows;
                  cPos.SetX(cx + (c - (cols - 1) / 2.0) * dx);
                  cPos.SetY(cy + (r - (rows - 1) / 2.0) * dy);
                  cPos.SetZ(0);
                } else {
                  cPos.SetX(params.value("/values/x"_json_pointer, 0.0));
                  cPos.SetY(params.value("/values/y"_json_pointer, 0.0));
                  cPos.SetZ(params.value("/values/z"_json_pointer, 0.0));
                }

                CQuaternion cOrient;
                std::string strId = GenerateEntityId(strPrefix);
                CEntity* pcEntity = nullptr;
                try {
                  if (strType == "box") {
                    CVector3 cSize(cmd.value("/size/x"_json_pointer, 0.3),
                                   cmd.value("/size/y"_json_pointer, 0.3),
                                   cmd.value("/size/z"_json_pointer, 0.3));
                    pcEntity = new CBoxEntity(strId, cPos, cOrient,
                      cmd.value("movable", true), cSize, cmd.value("mass", 1.0));
                  } else if (strType == "cylinder") {
                    pcEntity = new CCylinderEntity(strId, cPos, cOrient,
                      cmd.value("movable", true), cmd.value("radius", 0.15),
                      cmd.value("height", 0.5), cmd.value("mass", 1.0));
                  } else if (strType == "foot-bot") {
                    pcEntity = new CFootBotEntity(strId,
                      cmd["controller"].get<std::string>(), cPos, cOrient);
                  } else if (strType == "kheperaiv") {
#ifdef WEBVIZ_HAS_KHEPERAIV
                    pcEntity = new CKheperaIVEntity(strId,
                      cmd["controller"].get<std::string>(), cPos, cOrient);
#endif
                  }
                  if (pcEntity) {
                    m_cSimulator.GetLoopFunctions().AddEntity(*pcEntity);
                    /* Check collision for embodied entities */
                    CComposableEntity* pcComp = dynamic_cast<CComposableEntity*>(pcEntity);
                    if (pcComp && pcComp->HasComponent("body")) {
                      CEmbodiedEntity& cBody = pcComp->GetComponent<CEmbodiedEntity>("body");
                      if (cBody.IsCollidingWithSomething()) {
                        m_cSimulator.GetLoopFunctions().RemoveEntity(strId);
                        continue; /* retry */
                      }
                    }
                    vecPlacedIds.push_back(strId);
                    bPlaced = true;
                    ++unPlaced;
                  }
                } catch (CARGoSException& ex) {
                  LOGERR << "[WARN] distribute: failed to place " << strId
                         << ": " << ex.what() << '\n';
                  delete pcEntity;
                }
              }
            }
            LOG << "[INFO] Distributed " << unPlaced << "/" << unQuantity
                << " " << strType << " entities\n";
          });
        } catch (const std::exception& e) {
          LOGERR << "[ERROR] distribute: " << e.what() << '\n';
        }

      } else if (strCmd.compare("getMetadata") == 0) {
        /* Metadata is embedded in every broadcast — no separate response needed */

      } else {
        /* "command" key has unknown value */
        try {
          m_pcUserFunctions->HandleCommandFromClient(str_ip, c_json_command);
        } catch (const std::exception& e) {
          LOGERR
            << "[ERROR] Error in overridden function HandleCommandFromClient "
               "in UserFunction subclass implementation by user\n\t"
            << e.what() << '\n';
        }
      }

    } else {
      /* "command" key in the JSON doesn't exists */
      try {
        m_pcUserFunctions->HandleCommandFromClient(str_ip, c_json_command);
      } catch (const std::exception& e) {
        LOGERR
          << "[ERROR] Error in overridden function HandleCommandFromClient "
             "in UserFunction subclass implementation by user\n\t"
          << e.what() << '\n';
      }
    }
  }

  /****************************************/
  /****************************************/

  void CWebviz::PlayExperiment() {
    /* Make sure we are in the right state */
    if (
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_INITIALIZED &&
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_PAUSED) {
      LOGERR << "[WARNING] PlayExperiment() called in wrong state: "
             << Webviz::EExperimentStateToStr(m_eExperimentState) << '\n';

      // silently return;
      return;
    }
    /* Disable fast-forward */
    m_bFastForwarding = false;

    m_cSimulatorTickMillis = std::chrono::milliseconds(
      (long int)(CPhysicsEngine::GetSimulationClockTick() * 1000.0f));

    /* Change state and emit signals */
    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PLAYING;
    m_cWebServer->EmitEvent("Experiment playing", m_eExperimentState);

    LOG << "[INFO] Experiment playing" << '\n';

    m_cTimer.Start();
  }

  /****************************************/
  /****************************************/

  void CWebviz::FastForwardExperiment(unsigned short un_steps) {
    /* Make sure we are in the right state */
    if (
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_INITIALIZED &&
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_PAUSED) {
      LOGERR << "[WARNING] FastForwardExperiment() called in wrong state: "
             << Webviz::EExperimentStateToStr(m_eExperimentState)
             << ", Running the experiment in FastForward mode" << '\n';

      /* Do not fast forward if experiment is done */
      if (m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_DONE) {
        return;
      }
    }

    /* If Steps are passed, and valid else to use existing steps */
    if (1 <= un_steps && un_steps <= 1000) {
      /* Update FF steps variable */
      m_unDrawFrameEvery = un_steps;
    }

    m_bFastForwarding = true;

    m_cSimulatorTickMillis = std::chrono::milliseconds(
      (long int)(CPhysicsEngine::GetSimulationClockTick() * 1000.0f));

    /* Change state and emit signals */
    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING;
    m_cWebServer->EmitEvent("Experiment fast-forwarding", m_eExperimentState);

    LOG << "[INFO] Experiment fast-forwarding" << '\n';

    m_cTimer.Start();
  }

  /****************************************/
  /****************************************/

  void CWebviz::PauseExperiment() {
    /* Make sure we are in the right state */
    if (
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_PLAYING &&
      m_eExperimentState !=
        Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING) {
      LOGERR << "[WARNING] PauseExperiment() called in wrong state: "
             << Webviz::EExperimentStateToStr(m_eExperimentState) << '\n';

      return;
    }
    /* Disable fast-forward */
    m_bFastForwarding = false;

    /* Change state and emit signals */
    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PAUSED;
    m_cWebServer->EmitEvent("Experiment paused", m_eExperimentState);

    LOG << "[INFO] Experiment paused" << '\n';
  }

  /****************************************/
  /****************************************/

  void CWebviz::StepExperiment() {
    /* Make sure we are in the right state */
    if (
      m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_PLAYING ||
      m_eExperimentState ==
        Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING) {
      LOGERR << "[WARNING] StepExperiment() called in wrong state: "
             << Webviz::EExperimentStateToStr(m_eExperimentState)
             << " pausing the experiment to run a step" << '\n';

      /* Make experiment pause */
      m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PAUSED;

      /* Do not go further, as the while loop in SimulationThreadFunction might
       * be halfway into execution */
      return;
    }

    /* Disable fast-forward */
    m_bFastForwarding = false;

    if (!m_cSimulator.IsExperimentFinished()) {
      /* Drain queued commands before stepping */
      DrainCommandQueue();

      /* Run one step */
      m_cSimulator.UpdateSpace();

      /* Make experiment pause */
      m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PAUSED;

      /* Change state and emit signals */
      m_cWebServer->EmitEvent("Experiment step done", m_eExperimentState);
    } else {
      LOG << "[INFO] Experiment done" << '\n';

      /* The experiment is done */
      m_cSimulator.GetLoopFunctions().PostExperiment();

      /* Set Experiment state to Done */
      m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_DONE;

      /* Change state and emit signals */
      m_cWebServer->EmitEvent("Experiment done", m_eExperimentState);
    }

    /* Broadcast current experiment state */
    BroadcastExperimentState();
  }

  /****************************************/
  /****************************************/

  void CWebviz::ResetExperiment() {
    /* Reset Simulator */
    m_cSimulator.Reset();

    /* Disable fast-forward */
    m_bFastForwarding = false;

    /* Reset the simulator if Reset was called after experiment was done */
    if (m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_DONE) {
      /* Reset simulator */
      m_cSimulator.Reset();
    }

    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_INITIALIZED;
    m_bSchemaSent = false;  /* Re-send schema on next broadcast */
    m_unStepsSinceKeyframe = 0;

    /* Change state and emit signals */
    m_cWebServer->EmitEvent("Experiment reset", m_eExperimentState);

    /* Broadcast current experiment state */
    BroadcastExperimentState();

    LOG << "[INFO] Experiment reset" << '\n';
  }

  /****************************************/
  /****************************************/

  void CWebviz::TerminateExperiment() {
    /* Make sure we are in the right state */
    if (
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_PLAYING &&
      m_eExperimentState != Webviz::EExperimentState::EXPERIMENT_PAUSED &&
      m_eExperimentState !=
        Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING) {
      LOGERR << "[WARNING] TerminateExperiment() called in wrong state: "
             << Webviz::EExperimentStateToStr(m_eExperimentState) << '\n';

      return;
    }
    /* Disable fast-forward */
    m_bFastForwarding = false;

    /* Call ARGoS to terminate the experiment */
    CSimulator::GetInstance().Terminate();
    CSimulator::GetInstance().GetLoopFunctions().PostExperiment();

    /* Set Experiment state to Done */
    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_DONE;

    /* Change state and emit signals */
    m_cWebServer->EmitEvent("Experiment done", m_eExperimentState);

    LOG << "[INFO] Experiment done" << '\n';
  }

  /****************************************/
  /****************************************/

  void CWebviz::BroadcastExperimentState() {
    /************* Build a JSON object to be sent to all clients *************/
    nlohmann::json cStateJson;

    /************* Convert Entities info to JSON *************/

    /* Get all entities in the experiment */
    CEntity::TVector& vecEntities = m_cSpace.GetRootEntityVector();

    nlohmann::json cCurrentEntities = nlohmann::json::array();

    for (auto itEntities = vecEntities.begin();  //
         itEntities != vecEntities.end();        //
         ++itEntities) {
      /************* Generate JSON from Entities *************/

      auto cEntityJSON = CallEntityOperation<
        CWebvizOperationGenerateJSON,
        CWebviz,
        nlohmann::json>(*this, **itEntities);

      if (cEntityJSON != nullptr) {
        /************* get data from User functions for entity *************/
        const nlohmann::json& user_data = m_pcUserFunctions->Call(**itEntities);

        if (!user_data.is_null() && m_bSendEntityData) {
          if (m_setEntityDataFields.empty()) {
            cEntityJSON["user_data"] = user_data;
          } else {
            nlohmann::json cFiltered;
            for (const auto& field : m_setEntityDataFields) {
              if (user_data.contains(field)) {
                cFiltered[field] = user_data[field];
              }
            }
            if (!cFiltered.is_null()) {
              cEntityJSON["user_data"] = std::move(cFiltered);
            }
          }
        }

        cCurrentEntities.push_back(cEntityJSON);
      } else {
        LOGERR << "[ERROR] Unknown Entity:"
               << (**itEntities).GetTypeDescription() << "\n"
               << "Please register a class to convert Entity to JSON, "
               << "Check documentation for how to implement custom entity";
      }
    }

    /************* Delta encoding *************/
    if (m_bDeltaMode) {
      if (!m_bSchemaSent || m_unStepsSinceKeyframe >= m_unKeyframeInterval) {
        /* Send full schema: first frame or keyframe interval */
        cStateJson["type"] = "schema";
        cStateJson["entities"] = cCurrentEntities;
        m_cPrevEntities = cCurrentEntities;
        m_bSchemaSent = true;
        m_unStepsSinceKeyframe = 0;
      } else {
        m_unStepsSinceKeyframe++;
        /* Compute delta */
        cStateJson["type"] = "delta";
        nlohmann::json cDelta = nlohmann::json::object();

        /* Build prev lookup */
        std::unordered_map<std::string, const nlohmann::json*> mapPrev;
        for (auto& e : m_cPrevEntities) {
          mapPrev[e["id"].get<std::string>()] = &e;
        }

        for (auto& cEntity : cCurrentEntities) {
          const std::string& strId = cEntity["id"].get<std::string>();
          auto it = mapPrev.find(strId);

          if (it == mapPrev.end()) {
            cDelta[strId] = cEntity;
            continue;
          }

          const nlohmann::json& cPrev = *(it->second);
          nlohmann::json cChanged;

          for (auto& [key, val] : cEntity.items()) {
            if (key == "type" || key == "id") continue;
            if (!cPrev.contains(key) || cPrev[key] != val) {
              cChanged[key] = val;
            }
          }

          if (!cChanged.empty()) {
            cDelta[strId] = std::move(cChanged);
          }
        }

        cStateJson["entities"] = std::move(cDelta);
        m_cPrevEntities = cCurrentEntities;

        /* Detect removed entities */
        std::unordered_set<std::string> setCurrentIds;
        for (auto& c : cCurrentEntities) {
          setCurrentIds.insert(c["id"].get<std::string>());
        }
        nlohmann::json cRemoved = nlohmann::json::array();
        for (auto& [strPrevId, _] : mapPrev) {
          if (setCurrentIds.find(strPrevId) == setCurrentIds.end()) {
            cRemoved.push_back(strPrevId);
          }
        }
        if (!cRemoved.empty()) {
          cStateJson["removed"] = cRemoved;
        }
      }
    } else {
      /* Legacy full broadcast */
      cStateJson["type"] = "broadcast";
      cStateJson["entities"] = std::move(cCurrentEntities);
    }

    /************* Add other information about experiment *************/

    /* Get Arena details */

    const CVector3& cArenaSize = m_cSpace.GetArenaSize();
    cStateJson["arena"]["size"]["x"] = cArenaSize.GetX();
    cStateJson["arena"]["size"]["y"] = cArenaSize.GetY();
    cStateJson["arena"]["size"]["z"] = cArenaSize.GetZ();

    const CVector3& cArenaCenter = m_cSpace.GetArenaCenter();
    cStateJson["arena"]["center"]["x"] = cArenaCenter.GetX();
    cStateJson["arena"]["center"]["y"] = cArenaCenter.GetY();
    cStateJson["arena"]["center"]["z"] = cArenaCenter.GetZ();

    // TODO: m_cSpace.GetArenaLimits();

    /************* Draw functions pre-broadcast *************/

    auto* pcDrawFunctions =
      dynamic_cast<Webviz::CWebvizDrawFunctions*>(m_pcUserFunctions);
    if (pcDrawFunctions != nullptr) {
      pcDrawFunctions->PreBroadcast(cArenaSize, cArenaCenter);
    }

    /************* get data from User functions for experiment *************/

    const nlohmann::json& user_data = m_pcUserFunctions->sendUserData();

    if (!user_data.is_null() && m_bSendGlobalData) {
      cStateJson["user_data"] = user_data;
    }
    /* Added Unix Epoch in milliseconds */
    cStateJson["timestamp"] =
      std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch())
        .count();

    /* Current state of the experiment */
    cStateJson["state"] = Webviz::EExperimentStateToStr(m_eExperimentState);

    /* Number of step from the simulator */
    cStateJson["steps"] = m_cSpace.GetSimulationClock();

    /* Metadata: available entity types and controllers */
    cStateJson["entity_types"] = {"box", "cylinder", "foot-bot", "kheperaiv"};
    {
      nlohmann::json cControllers = nlohmann::json::array();
      try {
        TConfigurationNode& tRoot = m_cSimulator.GetConfigurationRoot();
        TConfigurationNode& tControllers = GetNode(tRoot, "controllers");
        TConfigurationNodeIterator itCtrl;
        for (itCtrl = itCtrl.begin(&tControllers);
             itCtrl != itCtrl.end(); ++itCtrl) {
          std::string strCtrlId;
          GetNodeAttribute(*itCtrl, "id", strCtrlId);
          cControllers.push_back(strCtrlId);
        }
      } catch (const std::exception&) {}
      cStateJson["controllers"] = cControllers;
    }

    /* Real-time ratio: how fast sim runs vs wall clock */
    if (m_bFastForwarding) {
      /* In FF mode, measure actual throughput */
      if (m_cTimer.Elapsed().count() > 0) {
        double fSimTimeMs = static_cast<double>(m_cSimulatorTickMillis.count()) * m_unDrawFrameEvery;
        cStateJson["real_time_ratio"] = fSimTimeMs / m_cTimer.Elapsed().count();
      }
    } else {
      /* In play mode, ratio equals the configured factor (sleep enforces it) */
      cStateJson["real_time_ratio"] = static_cast<double>(m_fRealTimeFactor);
    }

    /* Type of message */
    cStateJson["type"] = "broadcast";

    /* Send to webserver to broadcast */
    m_cWebServer->Broadcast(cStateJson);
  }

  /****************************************/
  /****************************************/

  void CWebviz::EnqueueCommand(std::function<void()> fn) {
    std::lock_guard<std::mutex> lock(m_mtxCommandQueue);
    m_vecCommandQueue.push_back(std::move(fn));
  }

  /****************************************/
  /****************************************/

  void CWebviz::DrainCommandQueue() {
    std::vector<std::function<void()>> vecCmds;
    {
      std::lock_guard<std::mutex> lock(m_mtxCommandQueue);
      vecCmds.swap(m_vecCommandQueue);
    }
    for (auto& fn : vecCmds) fn();
  }

  /****************************************/
  /****************************************/

  std::string CWebviz::GenerateEntityId(const std::string& str_prefix) {
    UInt32 unIdx = m_mapNextEntityIdx[str_prefix]++;
    return str_prefix + "_" + std::to_string(unIdx);
  }

  /****************************************/
  /****************************************/

  void CWebviz::MoveEntity(
    std::string str_entity_id, CVector3 c_pos, CQuaternion c_orientation) {
    /* throws CARGoSException if entity doesn't exist */
    try {
      CEntity* cEntity = &m_cSpace.GetEntity(str_entity_id);
      CEmbodiedEntity* pcEntity = dynamic_cast<CEmbodiedEntity*>(cEntity);

      if (pcEntity == NULL) {
        /* Treat selected entity as a composable entity with an embodied
         * component */
        CComposableEntity* pcCompEntity =
          dynamic_cast<CComposableEntity*>(cEntity);
        if (pcCompEntity != NULL && pcCompEntity->HasComponent("body")) {
          pcEntity = &pcCompEntity->GetComponent<CEmbodiedEntity>("body");
        } else {
          /* All conversions failed, get out */
          // s
          THROW_ARGOSEXCEPTION(
            "[ERROR] No entity found with id:" + str_entity_id);
          return;
        }
      }

      CVector3 cOldPos = pcEntity->GetOriginAnchor().Position;
      if (pcEntity->MoveTo(c_pos, c_orientation)) {
        LOG << "[INFO] Entity Moved (" + str_entity_id + ")" << '\n';

        /* Clear stale sensor rays — they were computed at the old position
         * and would appear offset if broadcast before the next UpdateSpace() */
        CComposableEntity* pcComp = dynamic_cast<CComposableEntity*>(cEntity);
        if (pcComp != NULL && pcComp->HasComponent("controller")) {
          pcComp->GetComponent<CControllableEntity>("controller")
            .GetCheckedRays().clear();
          pcComp->GetComponent<CControllableEntity>("controller")
            .GetIntersectionPoints().clear();
        }

        /* Call user function hook */
        if (m_pcUserFunctions != nullptr) {
          m_pcUserFunctions->EntityMoved(*cEntity, cOldPos, c_pos);
        }
      } else {
        LOGERR << "[WARNING] Entity cannot be moved, collision detected. (" +
                    str_entity_id + ")"
               << '\n';
      }
    } catch (CARGoSException& ex) {
      THROW_ARGOSEXCEPTION_NESTED(
        "[ERROR] No entity found with id:" + str_entity_id, ex);
    }
  }

  /****************************************/
  /****************************************/

  void CWebviz::Destroy() {
    /* Get rid of the factory */

    CFactory<CWebvizUserFunctions>::Destroy();
  }
  /****************************************/
  /****************************************/

  REGISTER_VISUALIZATION(
    CWebviz,
    "webviz",
    "Prajankya [prajankya@gmail.com]",
    ARGOS_WEBVIZ_VERSION,
    "An interactive web interface to manage argos simulation over network\n",
    "It allows the user to watch and modify the simulation as it's running \n"
    "in an intuitive way.\n\n"
    "REQUIRED XML CONFIGURATION\n\n"
    "  <visualization>\n"
    "    <webviz />\n"
    "  </visualization>\n\n"
    "OPTIONAL XML CONFIGURATION with all the defaults:\n\n"
    "  <visualization>\n"
    "    <webviz port=3000\n"
    "         broadcast_frequency=10\n"
    "         ff_draw_frames_every=2\n"
    "         autoplay=\"true\"\n"
    "         ssl_key_file=\"NULL\"\n"
    "         ssl_cert_file=\"NULL\"\n"
    "         ssl_ca_file=\"NULL\"\n"
    "         ssl_dh_params_file=\"NULL\"\n"
    "         ssl_cert_passphrase=\"NULL\"\n"
    "    />\n"
    "  </visualization>\n\n"
    "\n"
    "Where:\n"
    "port(unsigned short): is the network port to listen incoming \n"
    "\ttraffic on (Websockets and HTTP both share the same port)\n"
    "    Default: 3000\n"
    "    Range: [1,65535]\n"
    "        Note: Ports < 1024 need root privileges.\n\n"

    "broadcast_frequency(unsigned short): Frequency (in Hertz) at which\n"
    "\tto broadcast the updates(through websockets)\n"
    "    Default: 10\n"
    "    Range: [1,1000]\n\n"

    "ff_draw_frames_every(unsigned short): Number of steps to skip\n"
    "\twhen in fast forward mode\n"
    "    Default: 2\n\n"

    "autoplay(bool): Allows user to auto-play the simulation at startup\n"
    "    Default: false\n\n"
    "--\n\n"
    "SSL CONFIGURATION\n"
    "SSL can be used to host the server over \"wss\"(analogous to \n"
    "\t\"https\" for websockets).\n"
    "NOTE: You need Webviz to be compiled with OpenSSL support to use SSL.\n"
    "\n"
    "You might have to use any combination of the following to enable\n"
    "\t SSL, depending upon your implementation.\n"
    "\n"
    "\t* ssl_key_file\n"
    "\t* ssl_cert_file\n"
    "\t* ssl_ca_file\n"
    "\t* ssl_dh_params_file\n"
    "\t* ssl_cert_passphrase\n"
    "Where file parameters supports relative and absolute paths.\n"
    "\tNOTE:(It needs read access\n"
    "\t to the files)\n"
    "\n",
    "Usable");
}  // namespace argos