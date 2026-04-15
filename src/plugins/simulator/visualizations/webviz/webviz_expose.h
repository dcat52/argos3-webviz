/**
 * @file webviz_expose.h
 *
 * One-line macro for exposing controller internal state to webviz.
 *
 * Usage in any controller's Init():
 *   #include <webviz/webviz_expose.h>
 *   WEBVIZ_EXPOSE(m_unCounter, "counter");
 *   WEBVIZ_EXPOSE(m_bHasFood, "has_food");
 *
 * The generic webviz_auto_expose user_functions reads the registry
 * and serializes all exposed fields as per-entity user_data.
 */

#ifndef ARGOS_WEBVIZ_EXPOSE_H
#define ARGOS_WEBVIZ_EXPOSE_H

#include <nlohmann/json.hpp>
#include <functional>
#include <string>
#include <unordered_map>
#include <vector>

namespace webviz {

  struct ExposedField {
    std::string name;
    std::function<nlohmann::json()> getter;
  };

  /** Global per-entity registry: entity_id → list of exposed fields */
  inline std::unordered_map<std::string, std::vector<ExposedField>>& registry() {
    static std::unordered_map<std::string, std::vector<ExposedField>> reg;
    return reg;
  }

  /** Clear all registrations (call on Reset) */
  inline void clearRegistry() {
    registry().clear();
  }

}  // namespace webviz

/**
 * Register a controller member variable for webviz exposure.
 * Must be called from a method where `this` is a CCI_Controller
 * and GetId() returns the entity ID.
 */
#define WEBVIZ_EXPOSE(member, name) \
  webviz::registry()[GetId()].push_back({ \
    name, [this]() -> nlohmann::json { return member; } \
  })

#endif
