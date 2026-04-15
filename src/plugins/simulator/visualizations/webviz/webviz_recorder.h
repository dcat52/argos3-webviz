/**
 * @file webviz_recorder.h
 *
 * Headless recorder plugin for ARGoS webviz.
 * Writes experiment frames to a JSON-lines file without needing a browser.
 *
 * Usage in .argos XML:
 *   <visualization>
 *     <webviz_recorder output="experiment.argosrec"
 *                      every_n_steps="1"
 *                      autostart="true"
 *                      delta="true" />
 *   </visualization>
 */

#ifndef ARGOS_WEBVIZ_RECORDER_H
#define ARGOS_WEBVIZ_RECORDER_H

#include <argos3/core/simulator/visualization/visualization.h>
#include <argos3/core/simulator/space/space.h>
#include <argos3/core/simulator/entity/entity.h>
#include <nlohmann/json.hpp>

#include <fstream>
#include <zlib.h>
#include <string>
#include <unordered_map>

#include "webviz_user_functions.h"

namespace argos {

  class CWebvizRecorder : public CVisualization {
   public:
    CWebvizRecorder();
    virtual ~CWebvizRecorder() {}

    virtual void Init(TConfigurationNode& t_tree);
    virtual void Execute();
    virtual void Reset() {}
    virtual void Destroy();

   private:
    /** Build full JSON state for current frame */
    nlohmann::json BuildFrame();

    /** Compute delta between current and previous frame */
    nlohmann::json ComputeDelta(const nlohmann::json& cCurrent);

    /** Write a line to the output file */
    void WriteFrame(const nlohmann::json& cFrame);

    CSpace& m_cSpace;
    CWebvizUserFunctions* m_pcUserFunctions;

    std::string m_strOutputFile;
    std::ofstream m_cOutStream;

    /** Gzip file handle (used when output ends with .gz) */
    gzFile m_gzFile = nullptr;
    bool m_bGzip = false;

    unsigned int m_unEveryNSteps;
    bool m_bAutoStart;
    bool m_bDeltaMode;

    /** Previous frame for delta computation */
    nlohmann::json m_cPrevEntities;
    bool m_bSchemaWritten;

    /** Step counter for frame skipping */
    unsigned long m_unStepCount;
  };

}  // namespace argos

#endif
