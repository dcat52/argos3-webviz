/**
 * @file webviz_draw_functions.h
 *
 * Webviz equivalent of QT-OpenGL drawing primitives.
 * Provides DrawCircle, DrawCylinder, DrawRay, DrawText with the same
 * signatures as CQTOpenGLUserFunctions. Serializes shapes as JSON
 * in user_data._draw for client-next rendering.
 *
 * Usage: subclass CWebvizDrawFunctions instead of CWebvizUserFunctions,
 * override DrawInWorld() and/or per-entity Draw() methods.
 */

#ifndef ARGOS_WEBVIZ_DRAW_FUNCTIONS_H
#define ARGOS_WEBVIZ_DRAW_FUNCTIONS_H

#include "webviz_user_functions.h"
#include <argos3/core/utility/datatypes/color.h>
#include <argos3/core/utility/math/vector3.h>
#include <argos3/core/utility/math/quaternion.h>
#include <argos3/core/utility/math/ray3.h>
#include <nlohmann/json.hpp>
#include <vector>
#include <map>
#include <string>

namespace argos {
  namespace Webviz {

    class CWebvizDrawFunctions : public CWebvizUserFunctions {
     public:
      CWebvizDrawFunctions() = default;
      virtual ~CWebvizDrawFunctions() = default;

      /** Override to draw world-space shapes each tick */
      virtual void DrawInWorld() {}

      /** Auto-injects _draw and _floor into user_data */
      const nlohmann::json sendUserData() override;

      // --- Drawing primitives (mirror QT-OpenGL API) ---

      void DrawCircle(const CVector3& c_position,
                      const CQuaternion& c_orientation,
                      Real f_radius,
                      const CColor& c_color = CColor::RED,
                      bool b_fill = true,
                      UInt32 un_vertices = 20);

      void DrawCylinder(const CVector3& c_position,
                        const CQuaternion& c_orientation,
                        Real f_radius,
                        Real f_height,
                        const CColor& c_color = CColor::RED);

      void DrawRay(const CRay3& c_ray,
                   const CColor& c_color = CColor::RED,
                   Real f_width = 1.0f);

      void DrawText(const CVector3& c_position,
                    const std::string& str_text,
                    const CColor& c_color = CColor::BLACK);

      // --- Floor painting ---

      /** Set floor grid resolution (default 64) */
      void SetFloorResolution(UInt32 un_resolution) { m_unFloorResolution = un_resolution; }

      /** Mark floor as needing re-sample next tick */
      void SetFloorChanged() { m_bFloorDirty = true; }

      /** Sample GetFloorColor() on a grid and store result */
      void SampleFloor(const CVector3& c_arena_size, const CVector3& c_arena_center);

      /** Override to provide floor colors */
      virtual CColor GetFloorColor(Real f_x, Real f_y) { return CColor::WHITE; }

      // --- Serialization (called by framework) ---

      /** Get world-space draw commands and clear buffer */
      nlohmann::json GetDrawCommands();

      /** Get floor color grid data */
      nlohmann::json GetFloorData();

      /** Called before each broadcast — invokes DrawInWorld() */
      void PreBroadcast(const CVector3& c_arena_size, const CVector3& c_arena_center);

     private:
      static nlohmann::json ColorToJson(const CColor& c);

      std::vector<nlohmann::json> m_vecWorldDraws;
      UInt32 m_unFloorResolution = 64;
      std::vector<UInt8> m_vecFloorColors;
      bool m_bFloorDirty = true;
    };

  }  // namespace Webviz
}  // namespace argos

#endif
