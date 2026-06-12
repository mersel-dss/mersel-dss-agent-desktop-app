; Mersel İmzamatik — NSIS installer hook'ları (Tauri v2 `nsis.installerHooks`).
;
; Kurulum perMachine (admin/UAC) olduğundan, kurulum sırasında gömülü servisleri
; GERÇEK Windows Service'leri olarak kaydedebiliriz (services.msc'de görünür,
; Session 0'da gizli koşar). Kayıt/kaldırma işini bundle'a paketlenen PowerShell
; scriptleri yapar (win-service\register.ps1 / unregister.ps1).
;
; PowerShell çağrılarının çıkış kodu YOK SAYILIR: servis kaydı başarısız olsa bile
; kurulum/kaldırma akışı bloke olmamalı (uygulama yine de child-process'e düşer).

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Mersel Windows servisleri kaydediliyor (WinSW)..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\win-service\register.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  DetailPrint "Servis kaydı tamamlandı (kod: $0)."
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Mersel Windows servisleri kaldiriliyor..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\win-service\unregister.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  DetailPrint "Servis kaldirma tamamlandi (kod: $0)."
!macroend
