/**
 * @file
 * <argos3/plugins/simulator/visualizations/webviz/webviz_user_functions.cpp>
 *
 * @author Prajankya Sonar - <prajankya@gmail.com>
 *
 * @project ARGoS3-Webviz <https://github.com/NESTlab/argos3-webviz>
 *
 * MIT License
 * Copyright (c) 2020 NEST Lab
 */

#include "webviz_user_functions.h"

namespace argos {

  CWebvizUserFunctions::CWebvizUserFunctions() : m_vecFunctionHolders(1) {
    m_cThunks.Add<CEntity>((TThunk)NULL);
  }

  /****************************************/
  /****************************************/

  CWebvizUserFunctions::~CWebvizUserFunctions() {
    while (!m_vecFunctionHolders.empty()) {
      delete m_vecFunctionHolders.back();
      m_vecFunctionHolders.pop_back();
    }
  }

  /****************************************/
  /****************************************/

  const nlohmann::json CWebvizUserFunctions::Call(CEntity& c_entity) {
    TThunk t_thunk = m_cThunks[c_entity.GetTag()];
    if (t_thunk) {
      return (this->*t_thunk)(c_entity);
    } else {
      return nullptr;
    }
  }

  /****************************************/
  /****************************************/

  void CWebvizUserFunctions::AddButton(
      const std::string& str_id, const std::string& str_label,
      std::function<void()> fn_callback) {
    m_vecUIControls.push_back({str_id, "button", str_label, {}, 
      [fn_callback](const nlohmann::json&) { fn_callback(); }});
  }

  void CWebvizUserFunctions::AddSlider(
      const std::string& str_id, const std::string& str_label,
      Real f_min, Real f_max, Real f_value,
      std::function<void(Real)> fn_callback) {
    m_vecUIControls.push_back({str_id, "slider", str_label,
      {{"min", f_min}, {"max", f_max}, {"value", f_value}},
      [fn_callback](const nlohmann::json& c) {
        fn_callback(c.value("value", 0.0));
      }});
  }

  void CWebvizUserFunctions::AddToggle(
      const std::string& str_id, const std::string& str_label,
      bool b_value, std::function<void(bool)> fn_callback) {
    m_vecUIControls.push_back({str_id, "toggle", str_label,
      {{"value", b_value}},
      [fn_callback](const nlohmann::json& c) {
        fn_callback(c.value("value", false));
      }});
  }

  void CWebvizUserFunctions::AddDropdown(
      const std::string& str_id, const std::string& str_label,
      const std::vector<std::string>& vec_options,
      const std::string& str_value,
      std::function<void(const std::string&)> fn_callback) {
    m_vecUIControls.push_back({str_id, "dropdown", str_label,
      {{"options", vec_options}, {"value", str_value}},
      [fn_callback](const nlohmann::json& c) {
        fn_callback(c.value("value", std::string()));
      }});
  }

  void CWebvizUserFunctions::SetControlValue(
      const std::string& str_id, const nlohmann::json& c_value) {
    for (auto& ctrl : m_vecUIControls) {
      if (ctrl.Id == str_id) {
        ctrl.Config["value"] = c_value;
        return;
      }
    }
  }

  nlohmann::json CWebvizUserFunctions::SerializeControls() const {
    if (m_vecUIControls.empty()) return nullptr;
    nlohmann::json arr = nlohmann::json::array();
    for (const auto& ctrl : m_vecUIControls) {
      nlohmann::json c = {{"type", ctrl.Type}, {"id", ctrl.Id}, {"label", ctrl.Label}};
      for (auto& [key, val] : ctrl.Config.items()) c[key] = val;
      arr.push_back(std::move(c));
    }
    return arr;
  }

  void CWebvizUserFunctions::DispatchUIAction(const nlohmann::json& c_command) {
    const std::string strId = c_command.value("control_id", std::string());
    for (auto& ctrl : m_vecUIControls) {
      if (ctrl.Id == strId) {
        ctrl.Callback(c_command);
        return;
      }
    }
  }

}  // namespace argos