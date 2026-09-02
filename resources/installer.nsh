; Insurance Desk — ask for the E26 verification key during Windows setup.
; Used by electron-builder (package.json → build.nsis.include).
;
; electron-builder compiles this file for BOTH the installer and the
; uninstaller, and treats NSIS warnings as errors. Installer-only symbols
; must stay inside !ifndef BUILD_UNINSTALLER.

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  Page custom VerificationKeyPage VerificationKeyPageLeave
!macroend

!ifndef BUILD_UNINSTALLER
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  Var VerificationKey
  Var VerificationDialog
  Var VerificationKeyHWND

  Function VerificationKeyPage
    IfFileExists "$APPDATA\ShopDesk\shopdesk-data\license\activation.jwt" skip_key_page
    IfFileExists "$APPDATA\insurance-shop\shopdesk-data\license\activation.jwt" skip_key_page
    Goto show_key_page
    skip_key_page:
      Abort
    show_key_page:

    nsDialogs::Create 1018
    Pop $VerificationDialog
    ${If} $VerificationDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 36u "Insurance Desk will not open until this key is entered. Paste the verification key (license key) from your E26 email or WhatsApp message."
    Pop $0

    ${NSD_CreateLabel} 0 42u 100% 12u "Verification key"
    Pop $0

    ${NSD_CreateText} 0 56u 100% 14u $VerificationKey
    Pop $VerificationKeyHWND

    ${NSD_CreateLabel} 0 78u 100% 24u "Internet is needed once after install to activate. Daily shop work stays on this computer."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function VerificationKeyPageLeave
    ${NSD_GetText} $VerificationKeyHWND $VerificationKey

    Push $VerificationKey
    Call TrimVerificationKey
    Pop $VerificationKey

    StrLen $0 $VerificationKey
    ${If} $0 < 10
      MessageBox MB_OK|MB_ICONEXCLAMATION "Please enter the verification key from E26.$\r$\n$\r$\nIt looks like E26-INS-XXXX-XXXX-XXXX."
      Abort
    ${EndIf}
  FunctionEnd

  Function TrimVerificationKey
    Exch $R0
    Push $R1
    Push $R2

    loop_left:
      StrCpy $R1 $R0 1
      ${If} $R1 == " "
      ${OrIf} $R1 == "$\t"
        StrCpy $R0 $R0 "" 1
        Goto loop_left
      ${EndIf}

    loop_right:
      StrLen $R2 $R0
      ${If} $R2 == 0
        Goto trim_done
      ${EndIf}
      IntOp $R2 $R2 - 1
      StrCpy $R1 $R0 1 $R2
      ${If} $R1 == " "
      ${OrIf} $R1 == "$\t"
        StrCpy $R0 $R0 $R2
        Goto loop_right
      ${EndIf}

    trim_done:
    Pop $R2
    Pop $R1
    Exch $R0
  FunctionEnd
!endif

!macro customInstall
  !ifndef BUILD_UNINSTALLER
    ${If} $VerificationKey != ""
      CreateDirectory "$APPDATA\ShopDesk"
      CreateDirectory "$APPDATA\ShopDesk\shopdesk-data"
      CreateDirectory "$APPDATA\ShopDesk\shopdesk-data\license"
      FileOpen $0 "$APPDATA\ShopDesk\shopdesk-data\license\pending-key.txt" w
      FileWrite $0 $VerificationKey
      FileClose $0

      CreateDirectory "$APPDATA\insurance-shop"
      CreateDirectory "$APPDATA\insurance-shop\shopdesk-data"
      CreateDirectory "$APPDATA\insurance-shop\shopdesk-data\license"
      FileOpen $0 "$APPDATA\insurance-shop\shopdesk-data\license\pending-key.txt" w
      FileWrite $0 $VerificationKey
      FileClose $0
    ${EndIf}
  !endif
!macroend
