/**
 * @file webviz_draw_functions.cpp
 */

#include "webviz_draw_functions.h"
#include <sstream>

namespace argos {
  namespace Webviz {

    nlohmann::json CWebvizDrawFunctions::ColorToJson(const CColor& c) {
      return {c.GetRed(), c.GetGreen(), c.GetBlue(), c.GetAlpha()};
    }

    void CWebvizDrawFunctions::DrawCircle(
        const CVector3& c_position, const CQuaternion&,
        Real f_radius, const CColor& c_color, bool b_fill, UInt32) {
      m_vecWorldDraws.push_back({
        {"shape", "circle"},
        {"pos", {c_position.GetX(), c_position.GetY(), c_position.GetZ()}},
        {"radius", f_radius},
        {"color", ColorToJson(c_color)},
        {"fill", b_fill}
      });
    }

    void CWebvizDrawFunctions::DrawCylinder(
        const CVector3& c_position, const CQuaternion&,
        Real f_radius, Real f_height, const CColor& c_color) {
      m_vecWorldDraws.push_back({
        {"shape", "cylinder"},
        {"pos", {c_position.GetX(), c_position.GetY(), c_position.GetZ()}},
        {"radius", f_radius},
        {"height", f_height},
        {"color", ColorToJson(c_color)}
      });
    }

    void CWebvizDrawFunctions::DrawRay(
        const CRay3& c_ray, const CColor& c_color, Real f_width) {
      CVector3 s = c_ray.GetStart(), e = c_ray.GetEnd();
      m_vecWorldDraws.push_back({
        {"shape", "ray"},
        {"start", {s.GetX(), s.GetY(), s.GetZ()}},
        {"end", {e.GetX(), e.GetY(), e.GetZ()}},
        {"color", ColorToJson(c_color)},
        {"width", f_width}
      });
    }

    void CWebvizDrawFunctions::DrawText(
        const CVector3& c_position, const std::string& str_text,
        const CColor& c_color) {
      m_vecWorldDraws.push_back({
        {"shape", "text"},
        {"pos", {c_position.GetX(), c_position.GetY(), c_position.GetZ()}},
        {"text", str_text},
        {"color", ColorToJson(c_color)}
      });
    }

    void CWebvizDrawFunctions::SampleFloor(
        const CVector3& c_arena_size, const CVector3& c_arena_center) {
      UInt32 res = m_unFloorResolution;
      m_vecFloorColors.resize(res * res * 3);

      Real fMinX = c_arena_center.GetX() - c_arena_size.GetX() / 2.0;
      Real fMinY = c_arena_center.GetY() - c_arena_size.GetY() / 2.0;
      Real fStepX = c_arena_size.GetX() / res;
      Real fStepY = c_arena_size.GetY() / res;

      for (UInt32 y = 0; y < res; y++) {
        for (UInt32 x = 0; x < res; x++) {
          CColor c = GetFloorColor(
            fMinX + (x + 0.5) * fStepX,
            fMinY + (y + 0.5) * fStepY);
          UInt32 idx = (y * res + x) * 3;
          m_vecFloorColors[idx]     = c.GetRed();
          m_vecFloorColors[idx + 1] = c.GetGreen();
          m_vecFloorColors[idx + 2] = c.GetBlue();
        }
      }
    }

    nlohmann::json CWebvizDrawFunctions::GetDrawCommands() {
      nlohmann::json result = std::move(m_vecWorldDraws);
      m_vecWorldDraws.clear();
      return result;
    }

    nlohmann::json CWebvizDrawFunctions::GetFloorData() {
      if (m_vecFloorColors.empty()) return nullptr;

      // Base64 encode
      static const char b64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      std::string encoded;
      encoded.reserve((m_vecFloorColors.size() + 2) / 3 * 4);
      for (size_t i = 0; i < m_vecFloorColors.size(); i += 3) {
        UInt32 n = (m_vecFloorColors[i] << 16);
        if (i + 1 < m_vecFloorColors.size()) n |= (m_vecFloorColors[i + 1] << 8);
        if (i + 2 < m_vecFloorColors.size()) n |= m_vecFloorColors[i + 2];
        encoded += b64[(n >> 18) & 0x3F];
        encoded += b64[(n >> 12) & 0x3F];
        encoded += (i + 1 < m_vecFloorColors.size()) ? b64[(n >> 6) & 0x3F] : '=';
        encoded += (i + 2 < m_vecFloorColors.size()) ? b64[n & 0x3F] : '=';
      }

      return {
        {"resolution", m_unFloorResolution},
        {"colors", encoded}
      };
    }

    void CWebvizDrawFunctions::PreBroadcast(
        const CVector3& c_arena_size, const CVector3& c_arena_center) {
      m_vecWorldDraws.clear();
      DrawInWorld();
      SampleFloor(c_arena_size, c_arena_center);
    }

  }  // namespace Webviz
}  // namespace argos
