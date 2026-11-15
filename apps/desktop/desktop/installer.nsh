!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!ifndef BUILD_UNINSTALLER
Var AtlasVoiceCheckbox
Var AtlasVoiceRequested
!macro customPageAfterChangeDir
  Page custom AtlasVoicePage AtlasVoicePageLeave
; Expand the page functions after electron-builder includes MUI2.nsh.
Function AtlasVoicePage
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Optional ARES voice" "Choose whether to set up offline spoken replies."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 34u "ARES can speak without installed Windows voices using an optional local engine and English voice pack."
  Pop $0
  ${NSD_CreateCheckbox} 0 42u 100% 22u "Set up optional offline spoken replies after installation"
  Pop $AtlasVoiceCheckbox
  ${NSD_SetState} $AtlasVoiceCheckbox ${BST_UNCHECKED}
  ${NSD_CreateLabel} 0 76u 100% 54u "The app will show the exact download and installed sizes. Download the matching voice ZIP from the private release and select it in the app. You can skip this and add the pack later in ARES Voice settings. No speech engine or output voice is included in this setup file."
  Pop $0
  nsDialogs::Show
FunctionEnd
Function AtlasVoicePageLeave
  ${NSD_GetState} $AtlasVoiceCheckbox $AtlasVoiceRequested
FunctionEnd
!macroend
!macro customInstall
  ${If} $AtlasVoiceRequested == ${BST_CHECKED}
    WriteINIStr "$INSTDIR\resources\voice-install.ini" "voice" "requested" "1"
  ${Else}
    WriteINIStr "$INSTDIR\resources\voice-install.ini" "voice" "requested" "0"
  ${EndIf}
!macroend
!endif
