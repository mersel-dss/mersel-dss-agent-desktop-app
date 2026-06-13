; Mersel İmzamatik — NSIS installer hook'ları (Tauri v2 `nsis.installerHooks`).
;
; Kurulum perMachine (admin/UAC) olduğundan, kurulum sırasında gömülü servisleri
; GERÇEK Windows Service'leri olarak kaydedebiliriz (services.msc'de görünür,
; Session 0'da gizli koşar). Kayıt/kaldırma işini bundle'a paketlenen PowerShell
; scriptleri yapar (win-service\register.ps1 / unregister.ps1).
;
; PowerShell çağrılarının çıkış kodu YOK SAYILIR: servis kaydı başarısız olsa bile
; kurulum/kaldırma akışı bloke olmamalı (uygulama yine de child-process'e düşer).

; Dosyalar yazılmadan ÖNCE çalışan servisleri durdur. GÜNCELLEME senaryosunda eski
; Windows Servislerinin java.exe'si gömülü JRE DLL'lerini (jre21\bin\*.dll) AÇIK
; tutar; bu yüzden NSIS dosyaların üzerine yazamaz ve "Error opening file for
; writing: ...\jre21\bin\extnet.dll" hatası alınır. `net stop` SENKRONDUR: servis
; (ve sardığı java.exe / Web.exe) tamamen STOPPED olana kadar bekler → kilitler
; bırakılır. Servis yoksa (ilk kurulum) hata döner; YOK SAYILIR. Bu hook installer'a
; derlendiğinden, henüz bu hook'a sahip OLMAYAN bir sürümden güncellemeyi de düzeltir.
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Mersel Windows servisleri durduruluyor (dosya kilitleri için)..."
  nsExec::ExecToLog 'net.exe stop "MerselImzamatik-agent" /y'
  Pop $0
  nsExec::ExecToLog 'net.exe stop "MerselImzamatik-verifier" /y'
  Pop $0
  nsExec::ExecToLog 'net.exe stop "MerselImzamatik-xslt" /y'
  Pop $0
  nsExec::ExecToLog 'net.exe stop "MerselImzamatik-html-to-pdf" /y'
  Pop $0
  ; Süreç çıktıktan sonra OS'un dosya handle'larını bırakması için küçük güvenlik payı.
  Sleep 1500
  DetailPrint "Servisler durduruldu; kuruluma devam ediliyor."
!macroend

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
