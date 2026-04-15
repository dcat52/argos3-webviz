#
# Set minimum required version
#
cmake_minimum_required(VERSION 3.11)


#
# Project version
#
set(MAJOR_VERSION 0)
set(MINOR_VERSION 4)
set(PATCH_VERSION 77)

set(VERSION_STRING ${MAJOR_VERSION}.${MINOR_VERSION}.${PATCH_VERSION})

project(webviz LANGUAGES CXX)

message(STATUS "Building ARGoS3 Webviz :${VERSION_STRING}")

#
# Set C++ Version 17
#
set(CMAKE_CXX_STANDARD 17)

#
# Deactivate RPATH for MacOSX
#
set(CMAKE_MACOSX_RPATH 0)

#
# Set CMake policies to select wanted behaviors
#
# Use new policies introduced up to this version
cmake_policy(VERSION 2.8.12)
if(POLICY CMP0042)
  cmake_policy(SET CMP0042 NEW)
endif(POLICY CMP0042)

#
# add path where cmake files must be searched for
#
list(APPEND CMAKE_MODULE_PATH ${PROJECT_SOURCE_DIR}/cmake)


#
# Include path points to the base source dir
#
include_directories(${CMAKE_SOURCE_DIR} ${CMAKE_BINARY_DIR})

#
# Make sure we are under Unix
#
if(NOT UNIX)
    message(FATAL_ERROR "WebViz compiles only under UNIX, sorry!")
endif(NOT UNIX)

#
# Add all the CMake modules we need
#
include(DownloadProject)
# Set build options
include(ARGoSBuildOptions)
# Set compiler flags
include(ARGoSBuildFlags)
# Check for libraries
include(ARGoSBuildChecks)
# Set up CPack
include(ARGoSPackaging)
# Set FindArgosPlugin
include(FindARGoSPlugin)


#
# Testing
#
option(PACKAGE_TESTS "Build the tests" OFF)

string(TOUPPER "${CMAKE_BUILD_TYPE}" uppercase_CMAKE_BUILD_TYPE)

if (uppercase_CMAKE_BUILD_TYPE STREQUAL "DEBUG")
  set(IS_DEBUG_MODE True)
endif()

if (IS_DEBUG_MODE)
  message(STATUS "Debug mode: Building all tests")
  set(PACKAGE_TESTS ON)

   # Enable CPPcheck (static cpp code check)
   include(CppcheckTargets)
endif()


if(PACKAGE_TESTS)
  enable_testing()
  # Add Google test suite
  include(GoogleTest)
  
  # Add Code coverage from CMake
  include(CodeCoverage)
  append_coverage_compiler_flags()
  
  add_subdirectory(tests)
endif()

#
# Compile stuff
#
add_subdirectory(plugins)

add_subdirectory(testing)

#
# Client-next web client (optional — requires Node.js/npm)
#
find_program(NPM_EXECUTABLE npm)

if(NPM_EXECUTABLE)
  set(CLIENT_NEXT_DIR "${CMAKE_SOURCE_DIR}/../client-next")
  set(CLIENT_NEXT_DIST "${CLIENT_NEXT_DIR}/dist")
  set(CLIENT_NEXT_STAMP "${CMAKE_BINARY_DIR}/client-next.stamp")

  add_custom_command(
    OUTPUT ${CLIENT_NEXT_STAMP}
    COMMAND ${NPM_EXECUTABLE} ci --prefix ${CLIENT_NEXT_DIR}
    COMMAND ${NPM_EXECUTABLE} run build --prefix ${CLIENT_NEXT_DIR}
    COMMAND ${CMAKE_COMMAND} -E touch ${CLIENT_NEXT_STAMP}
    WORKING_DIRECTORY ${CLIENT_NEXT_DIR}
    COMMENT "Building client-next web client"
    DEPENDS ${CLIENT_NEXT_DIR}/package.json ${CLIENT_NEXT_DIR}/package-lock.json
  )

  add_custom_target(client-next ALL DEPENDS ${CLIENT_NEXT_STAMP})

  install(
    DIRECTORY ${CLIENT_NEXT_DIST}/
    DESTINATION share/argos3/plugins/simulator/visualizations/webviz/client
  )

  message(STATUS "client-next: npm found — web client will be built")
else()
  message(WARNING "npm not found — client-next will not be built. "
                  "Install Node.js to build the web client.")
endif()

# Add Uninstall target
add_custom_target(uninstall
  "${CMAKE_COMMAND}" -P "${CMAKE_SOURCE_DIR}/cmake/uninstall.cmake"
)