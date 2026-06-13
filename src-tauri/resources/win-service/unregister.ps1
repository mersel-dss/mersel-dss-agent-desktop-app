#requires -version 3
<#
  Mersel İmzamatik — Windows Service KALDIRMA scripti.

  NSIS uninstaller'ın PREUNINSTALL hook'undan (admin/UAC ile) çağrılır. Kayıtlı
  WinSW servislerini durdurup kaldırır ve ProgramData altındaki WinSW dizinlerini
  temizler. (Kullanıcı verisi / loglar bilinçli olarak BIRAKILIR; tam temizlik
  uninstaller'ın deleteAppData seçeneğine bırakılır.)
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = 'SilentlyContinue'

function Write-Log([string]$m) { Write-Output "[mersel-winsvc] $m" }

$DataRoot = Join-Path $env:ProgramData 'Mersel\Imzamatik'
$Kinds = @('agent', 'verifier', 'xslt')

foreach ($kind in $Kinds) {
  $id = "MerselImzamatik-$kind"
  $winswExe = Join-Path $DataRoot "winsw\$id\$id.exe"

  if (Test-Path $winswExe) {
    Write-Log "${kind}: durduruluyor + kaldırılıyor ($id)"
    try { & $winswExe stop 2>$null | Out-Null } catch {}
    try { & $winswExe uninstall 2>$null | Out-Null } catch {}
  }
  else {
    # WinSW kopyası yoksa servisi sc ile düşürmeyi dene.
    try { & sc.exe stop $id 2>$null | Out-Null } catch {}
    try { & sc.exe delete $id 2>$null | Out-Null } catch {}
  }

  # Eski (v0.1.12) Scheduled Task kalıntısı varsa temizle.
  try { & schtasks.exe /End    /TN $id     2>$null | Out-Null } catch {}
  try { & schtasks.exe /Delete /TN $id /F  2>$null | Out-Null } catch {}

  $winswDir = Join-Path $DataRoot "winsw\$id"
  if (Test-Path $winswDir) { Remove-Item -Recurse -Force $winswDir -ErrorAction SilentlyContinue }
}

Write-Log "Windows Service kaldırma tamamlandı."
exit 0
