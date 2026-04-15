/**
 * @file webviz_recorder.cpp
 *
 * Headless recorder — writes experiment frames to .argosrec (JSON-lines).
 * Each line is a self-contained JSON object:
 *   Line 1: {"type":"schema", "arena":{...}, "entities":[...]}
 *   Line N: {"type":"delta", "step":N, "entities":{"r0":{...}}} (or "full")
 *
 * The client can load this file and replay it.
 */

#include "webviz_recorder.h"

#include <argos3/core/simulator/entity/composable_entity.h>
#include <argos3/core/simulator/entity/embodied_entity.h>
#include <argos3/core/utility/plugins/dynamic_loading.h>
#include <argos3/plugins/simulator/entities/led_equipped_entity.h>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace argos {

  /****************************************/
  /* Generic entity serializer            */
  /****************************************/

  static nlohmann::json SerializeEntity(CEntity& c_entity) {
    nlohmann::json cJson;
    cJson["type"] = c_entity.GetTypeDescription();
    cJson["id"] = c_entity.GetId();

    /* Try to get embodied component for position/orientation */
    CComposableEntity* pcComp = dynamic_cast<CComposableEntity*>(&c_entity);
    if (pcComp && pcComp->HasComponent("body")) {
      CEmbodiedEntity& cBody = pcComp->GetComponent<CEmbodiedEntity>("body");
      const CVector3& cPos = cBody.GetOriginAnchor().Position;
      const CQuaternion& cOri = cBody.GetOriginAnchor().Orientation;

      cJson["position"] = {{"x", cPos.GetX()}, {"y", cPos.GetY()}, {"z", cPos.GetZ()}};
      cJson["orientation"] = {{"x", cOri.GetX()}, {"y", cOri.GetY()}, {"z", cOri.GetZ()}, {"w", cOri.GetW()}};
      cJson["is_movable"] = cBody.IsMovable();
    }

    /* Try to get LEDs */
    if (pcComp && pcComp->HasComponent("leds")) {
      try {
        CLEDEquippedEntity& cLEDs = pcComp->GetComponent<CLEDEquippedEntity>("leds");
        cJson["leds"] = nlohmann::json::array();
        for (UInt32 i = 0; i < cLEDs.GetLEDs().size(); i++) {
          const CColor& c = cLEDs.GetLED(i).GetColor();
          std::stringstream ss;
          ss << "0x" << std::setfill('0') << std::setw(6) << std::hex
             << (c.GetRed() << 16 | c.GetGreen() << 8 | c.GetBlue());
          cJson["leds"].push_back(ss.str());
        }
      } catch (...) {}
    }

    return cJson;
  }

namespace argos {

  /****************************************/
  /****************************************/

  CWebvizRecorder::CWebvizRecorder()
      : m_cSpace(m_cSimulator.GetSpace()),
        m_pcUserFunctions(nullptr),
        m_unEveryNSteps(1),
        m_bAutoStart(true),
        m_bDeltaMode(true),
        m_bSchemaWritten(false),
        m_unStepCount(0) {}

  /****************************************/
  /****************************************/

  void CWebvizRecorder::Init(TConfigurationNode& t_tree) {
    /* Parse XML attributes */
    GetNodeAttributeOrDefault(t_tree, "output", m_strOutputFile,
                              std::string("experiment.argosrec"));
    GetNodeAttributeOrDefault(t_tree, "every_n_steps", m_unEveryNSteps, 1u);
    GetNodeAttributeOrDefault(t_tree, "autostart", m_bAutoStart, true);
    GetNodeAttributeOrDefault(t_tree, "delta", m_bDeltaMode, true);

    if (m_unEveryNSteps < 1) m_unEveryNSteps = 1;

    /* Parse user functions (same pattern as CWebviz) */
    if (NodeExists(t_tree, "user_functions")) {
      TConfigurationNode tNode = GetNode(t_tree, "user_functions");
      std::string strLabel, strLibrary;
      GetNodeAttribute(tNode, "label", strLabel);
      GetNodeAttributeOrDefault(tNode, "library", strLibrary, strLibrary);
      try {
        if (!strLibrary.empty()) CDynamicLoading::LoadLibrary(strLibrary);
        m_pcUserFunctions = CFactory<CWebvizUserFunctions>::New(strLabel);
        m_pcUserFunctions->Init(tNode);
      } catch (CARGoSException& ex) {
        THROW_ARGOSEXCEPTION_NESTED("Failed opening user function library", ex);
      }
    } else {
      m_pcUserFunctions = new CWebvizUserFunctions;
    }

    /* Open output file */
    m_bGzip = m_strOutputFile.size() > 3 &&
              m_strOutputFile.substr(m_strOutputFile.size() - 3) == ".gz";

    if (m_bGzip) {
      m_gzFile = gzopen(m_strOutputFile.c_str(), "wb");
      if (!m_gzFile) {
        THROW_ARGOSEXCEPTION("Cannot open gzip output file: " + m_strOutputFile);
      }
    } else {
      m_cOutStream.open(m_strOutputFile, std::ios::out | std::ios::trunc);
      if (!m_cOutStream.is_open()) {
        THROW_ARGOSEXCEPTION("Cannot open output file: " + m_strOutputFile);
      }
    }

    /* Write header */
    nlohmann::json cHeader;
    cHeader["type"] = "header";
    cHeader["version"] = 2;
    cHeader["every_n_steps"] = m_unEveryNSteps;
    cHeader["delta"] = m_bDeltaMode;
    WriteFrame(cHeader);

    LOG << "[Recorder] Output: " << m_strOutputFile
        << " every_n_steps=" << m_unEveryNSteps
        << " delta=" << (m_bDeltaMode ? "true" : "false") << '\n';
  }

  /****************************************/
  /****************************************/

  nlohmann::json CWebvizRecorder::BuildFrame() {
    nlohmann::json cEntities = nlohmann::json::array();

    /* We need a CWebviz reference for the entity operation dispatch.
     * Since we don't have one, we use a static cast trick — the entity
     * operations only use the CWebviz parameter for dispatch, not for
     * any actual member access. This is safe because the operations
     * are stateless visitors. */
    CEntity::TVector& vecEntities = m_cSpace.GetRootEntityVector();
    for (auto* pEntity : vecEntities) {
      /* Build entity JSON manually for types we know */
      nlohmann::json cEntityJSON = SerializeEntity(*pEntity);

      if (!cEntityJSON.is_null()) {
        const nlohmann::json& userData = m_pcUserFunctions->Call(*pEntity);
        if (!userData.is_null()) cEntityJSON["user_data"] = userData;
        cEntities.push_back(std::move(cEntityJSON));
      }
    }
    return cEntities;
  }

  /****************************************/
  /****************************************/

  nlohmann::json CWebvizRecorder::ComputeDelta(
      const nlohmann::json& cCurrentEntities) {
    nlohmann::json cDelta = nlohmann::json::object();

    /* Build lookup of previous entities by ID */
    std::unordered_map<std::string, const nlohmann::json*> mapPrev;
    for (auto& e : m_cPrevEntities) {
      mapPrev[e["id"].get<std::string>()] = &e;
    }

    for (auto& cEntity : cCurrentEntities) {
      const std::string& strId = cEntity["id"].get<std::string>();
      auto it = mapPrev.find(strId);

      if (it == mapPrev.end()) {
        /* New entity — send full */
        cDelta[strId] = cEntity;
        continue;
      }

      const nlohmann::json& cPrev = *(it->second);
      nlohmann::json cChanged = nlohmann::json::object();

      /* Compare each field, skip type/id (always same) */
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

    return cDelta;
  }

  /****************************************/
  /****************************************/

  void CWebvizRecorder::WriteFrame(const nlohmann::json& cFrame) {
    std::string line = cFrame.dump(-1) + '\n';
    if (m_bGzip) {
      gzwrite(m_gzFile, line.c_str(), line.size());
    } else {
      m_cOutStream << line;
    }
  }

  /****************************************/
  /****************************************/

  void CWebvizRecorder::Execute() {
    if (m_bAutoStart) {
      /* Auto-play: run until done */
      while (!m_cSimulator.IsExperimentFinished()) {
        m_cSimulator.UpdateSpace();
        m_unStepCount++;

        if (m_unStepCount % m_unEveryNSteps == 0) {
          nlohmann::json cEntities = BuildFrame();

          if (!m_bSchemaWritten) {
            /* Write schema (full state) as first line */
            nlohmann::json cSchema;
            cSchema["type"] = "schema";
            cSchema["step"] = m_cSpace.GetSimulationClock();

            const CVector3& cSize = m_cSpace.GetArenaSize();
            const CVector3& cCenter = m_cSpace.GetArenaCenter();
            cSchema["arena"]["size"] = {{"x", cSize.GetX()}, {"y", cSize.GetY()}, {"z", cSize.GetZ()}};
            cSchema["arena"]["center"] = {{"x", cCenter.GetX()}, {"y", cCenter.GetY()}, {"z", cCenter.GetZ()}};
            cSchema["entities"] = cEntities;

            const nlohmann::json& globalUserData = m_pcUserFunctions->sendUserData();
            if (!globalUserData.is_null()) cSchema["user_data"] = globalUserData;

            WriteFrame(cSchema);
            m_cPrevEntities = cEntities;
            m_bSchemaWritten = true;
          } else if (m_bDeltaMode) {
            /* Delta frame */
            nlohmann::json cDelta = ComputeDelta(cEntities);
            if (!cDelta.empty()) {
              nlohmann::json cFrame;
              cFrame["type"] = "delta";
              cFrame["step"] = m_cSpace.GetSimulationClock();
              cFrame["entities"] = std::move(cDelta);

              const nlohmann::json& globalUserData = m_pcUserFunctions->sendUserData();
              if (!globalUserData.is_null()) cFrame["user_data"] = globalUserData;

              WriteFrame(cFrame);
            }
            m_cPrevEntities = cEntities;
          } else {
            /* Full frame every time */
            nlohmann::json cFrame;
            cFrame["type"] = "full";
            cFrame["step"] = m_cSpace.GetSimulationClock();
            cFrame["state"] = "EXPERIMENT_PLAYING";
            cFrame["entities"] = std::move(cEntities);

            const nlohmann::json& globalUserData = m_pcUserFunctions->sendUserData();
            if (!globalUserData.is_null()) cFrame["user_data"] = globalUserData;

            cFrame["timestamp"] = std::chrono::duration_cast<std::chrono::milliseconds>(
              std::chrono::system_clock::now().time_since_epoch()).count();

            WriteFrame(cFrame);
          }
        }
      }

      /* Post-experiment */
      m_cSimulator.GetLoopFunctions().PostExperiment();
      LOG << "[Recorder] Done. " << m_unStepCount << " steps, wrote to "
          << m_strOutputFile << '\n';
    }
  }

  /****************************************/
  /****************************************/

  void CWebvizRecorder::Destroy() {
    if (m_bGzip && m_gzFile) { gzclose(m_gzFile); m_gzFile = nullptr; }
    if (m_cOutStream.is_open()) m_cOutStream.close();
    if (m_pcUserFunctions) {
      m_pcUserFunctions->Destroy();
      delete m_pcUserFunctions;
      m_pcUserFunctions = nullptr;
    }
  }

  /****************************************/
  /****************************************/

  REGISTER_VISUALIZATION(
    CWebvizRecorder,
    "webviz_recorder",
    "Davis Catherman",
    "1.0",
    "Headless recorder for webviz experiment data.",
    "Records experiment frames to a .argosrec file (JSON-lines format)\n"
    "that can be replayed in the webviz client without ARGoS.\n\n"
    "REQUIRED XML CONFIGURATION\n\n"
    "  <visualization>\n"
    "    <webviz_recorder output=\"experiment.argosrec\" />\n"
    "  </visualization>\n\n"
    "OPTIONAL XML CONFIGURATION\n\n"
    "  every_n_steps=\"1\"  - Record every Nth step (default: 1)\n"
    "  autostart=\"true\"   - Auto-play and record (default: true)\n"
    "  delta=\"true\"       - Use delta encoding (default: true)\n",
    "Stable");

}  // namespace argos
