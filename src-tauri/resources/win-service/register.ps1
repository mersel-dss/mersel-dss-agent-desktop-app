#requires -version 3
<#
  Mersel İmzamatik — Windows Service KAYIT scripti.

  NSIS installer'ın POSTINSTALL hook'undan (admin/UAC ile) çağrılır. Gömülü JRE +
  servis jar'larını WinSW ile GERÇEK Windows Service'lerine sarmalar:
    • services.msc'de "MerselImzamatik-<kind>" adıyla görünür
    • Session 0'da GİZLİ koşar (pencere/konsol yok)
    • Otomatik başlar (boot) ve çökünce OS tarafından yeniden başlatılır

  Komut/argüman/ortam değişkenleri Rust tarafıyla (config.rs +
  process/manager.rs: fast_start_jvm_args / application_args / silent_env_vars)
  BİREBİR tutarlı tutulmalıdır.

  Idempotent'tir: servis zaten varsa önce durdurup kaldırır, sonra yeni
  artefaktlarla yeniden kurar (desktop app güncellemesinde sürüm senkronu).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$m) { Write-Output "[mersel-winsvc] $m" }

# --- Yollar ----------------------------------------------------------------
$WinSW       = Join-Path $InstallDir 'win-service\WinSW.exe'
$ServicesDir = Join-Path $InstallDir 'services'
$Jre8        = Join-Path $InstallDir 'jre\bin\java.exe'
$Jre21       = Join-Path $InstallDir 'jre21\bin\java.exe'

# LocalSystem servisinin yazabileceği kalıcı kök (loglar, XSLT asset'leri, WinSW).
$DataRoot = Join-Path $env:ProgramData 'Mersel\Imzamatik'

# Tanılama günlüğü: kurulum sorunlarını sonradan incelemek için tüm çıktı buraya da
# yazılır (C:\ProgramData\Mersel\Imzamatik\register.log). Best-effort.
try {
  New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
  Start-Transcript -Path (Join-Path $DataRoot 'register.log') -Append -Force | Out-Null
} catch {}

Write-Log "register.ps1 başladı. InstallDir=$InstallDir"

if (-not (Test-Path $WinSW)) {
  Write-Log "WinSW.exe bulunamadı ($WinSW); Windows Service kaydı atlanıyor."
  exit 0
}

# Ortak hızlı-başlat JVM bayrakları (fast_start_jvm_args + headless).
$BaseJvm = @('-Djava.awt.headless=true', '-XX:TieredStopAtLevel=1', '-Xshare:auto')

# Servis tanımları (config.rs ile birebir). Type: 'java' → gömülü JRE + -jar,
# 'native' → .NET self-contained Web.exe (html-to-pdf).
$Services = @(
  @{
    Kind    = 'agent'; Type = 'java'; Port = 15212; Java = $Jre8;
    Display = 'Mersel İmzamatik - İmzalama Servisi';
    AppArgs = @(
      '--mersel.signer.ui.enabled=false',
      '--mersel.signer.ui.splash-enabled=false',
      '--mersel.signer.ui.tray-enabled=false',
      '--mersel.signer.ui.window-enabled=false'
    );
    Env = @{ 'MERSEL_AGENT_UI' = 'false'; 'MERSEL_AGENT_UI_SPLASH' = 'false' }
  },
  @{
    Kind    = 'verifier'; Type = 'java'; Port = 8086; Java = $Jre8;
    Display = 'Mersel İmzamatik - Doğrulama Servisi';
    AppArgs = @(); Env = @{}
  },
  @{
    Kind    = 'xslt'; Type = 'java'; Port = 8080; Java = $Jre21;
    Display = 'Mersel İmzamatik - Önizleme Servisi';
    AppArgs = @(); Env = @{}  # XSLT asset env'i aşağıda doldurulur
  },
  @{
    Kind    = 'html-to-pdf'; Type = 'native'; Port = 5090;
    Display = 'Mersel İmzamatik - PDF Dönüştürme Servisi';
    AppArgs = @(); Env = @{}  # ASPNETCORE_URLS + Playwright env'i aşağıda doldurulur
  }
)

# XML metin değeri kaçışı.
function Esc([string]$s) {
  if ($null -eq $s) { return '' }
  $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

function Find-Jar([string]$kind) {
  $dir = Join-Path $ServicesDir $kind
  if (-not (Test-Path $dir)) { return $null }
  $jar = Get-ChildItem -Path $dir -Filter '*.jar' -File -ErrorAction SilentlyContinue |
    Sort-Object Name | Select-Object -First 1
  if ($jar) { return $jar.FullName } else { return $null }
}

# Native servisin (html-to-pdf) çalıştırılabilirini gömülü dizinde arar.
function Find-Native([string]$kind, [string]$exeName) {
  $dir = Join-Path $ServicesDir $kind
  if (-not (Test-Path $dir)) { return $null }
  $f = Get-ChildItem -Path $dir -Filter $exeName -File -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($f) { return $f.FullName } else { return $null }
}

foreach ($svc in $Services) {
  $kind = $svc.Kind
  $type = $svc.Type
  $id   = "MerselImzamatik-$kind"

  $workDir  = Join-Path $DataRoot "services\$kind"
  $logDir   = Join-Path $DataRoot "logs\$kind"
  $winswDir = Join-Path $DataRoot "winsw\$id"

  # Servisin env'i (kopya — kaynak hashtable'a dokunma).
  $env2 = @{}
  foreach ($k in $svc.Env.Keys) { $env2[$k] = $svc.Env[$k] }

  if ($type -eq 'java') {
    $executable = $svc.Java
    if (-not (Test-Path $executable)) {
      Write-Log "${kind}: JRE bulunamadı ($executable); atlanıyor."
      continue
    }
    $jar = Find-Jar $kind
    if (-not $jar) {
      Write-Log "${kind}: jar bulunamadı ($ServicesDir\$kind); atlanıyor."
      continue
    }
    $svcWorkDir = $workDir

    # XSLT: GİB doğrulama asset'lerini kalıcı dizinde tut + otomatik sync.
    if ($kind -eq 'xslt') {
      $assets = Join-Path $workDir 'assets'
      New-Item -ItemType Directory -Force -Path $assets | Out-Null
      $env2['XSLT_ASSETS_EXTERNAL_PATH']           = $assets
      $env2['XSLT_ASSETS_WATCH_ENABLED']           = 'true'
      $env2['VALIDATION_ASSETS_GIB_SYNC_ENABLED']  = 'true'
      $env2['VALIDATION_ASSETS_GIB_AUTO_SYNC']     = 'true'
      $env2['VALIDATION_ASSETS_GIB_SYNC_PATH']     = $assets
    }

    # <arguments>: JVM bayrakları + -jar + server ayarları + app argları.
    $argList = @()
    $argList += $BaseJvm
    $argList += '-jar'
    $argList += ('"{0}"' -f $jar)
    $argList += ("--server.port={0}" -f $svc.Port)
    $argList += '--server.address=127.0.0.1'
    $argList += $svc.AppArgs
    $arguments = ($argList -join ' ')
  }
  elseif ($type -eq 'native') {
    # .NET self-contained Web.exe (single-file). CWD = exe dizini (ASP.NET content
    # root + appsettings + .playwright sürücüsü oraya göre çözülür).
    $executable = Find-Native $kind 'Web.exe'
    if (-not $executable) {
      Write-Log "${kind}: Web.exe bulunamadı ($ServicesDir\$kind); atlanıyor."
      continue
    }
    $svcWorkDir = Split-Path $executable -Parent

    # Playwright Chromium'u runtime'da indirir → YAZILABİLİR bir tarayıcı yolu ve
    # single-file extract dizini ProgramData altında verilir (Program Files salt-okunur).
    $browsers = Join-Path $workDir 'ms-playwright'
    $extract  = Join-Path $workDir 'dotnet-extract'
    New-Item -ItemType Directory -Force -Path $browsers, $extract | Out-Null
    $env2['ASPNETCORE_URLS']                = ("http://127.0.0.1:{0}" -f $svc.Port)
    $env2['PLAYWRIGHT_BROWSERS_PATH']       = $browsers
    $env2['DOTNET_BUNDLE_EXTRACT_BASE_DIR'] = $extract

    $arguments = ''
  }
  else {
    Write-Log "${kind}: bilinmeyen tip '$type'; atlanıyor."
    continue
  }

  New-Item -ItemType Directory -Force -Path $workDir, $logDir, $winswDir | Out-Null

  $envXml = ''
  foreach ($k in $env2.Keys) {
    $envXml += "  <env name=`"$(Esc $k)`" value=`"$(Esc $env2[$k])`"/>`r`n"
  }

  $argXml = if ($arguments) { "  <arguments>$(Esc $arguments)</arguments>`r`n" } else { '' }

  $xml = @"
<?xml version="1.0" encoding="utf-8"?>
<service>
  <id>$(Esc $id)</id>
  <name>$(Esc $svc.Display)</name>
  <description>Mersel İmzamatik gömülü servisi ($kind). Masaüstü uygulamasıyla birlikte kurulur.</description>
  <executable>$(Esc $executable)</executable>
$argXml  <workingdirectory>$(Esc $svcWorkDir)</workingdirectory>
$envXml  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="5 sec"/>
  <stoptimeout>15 sec</stoptimeout>
  <logpath>$(Esc $logDir)</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>3</keepFiles>
  </log>
</service>
"@

  $winswExe = Join-Path $winswDir "$id.exe"
  $winswXml = Join-Path $winswDir "$id.xml"
  Copy-Item -Path $WinSW -Destination $winswExe -Force
  # UTF-8 BOM İLE yaz: WinSW/.NET XmlDocument böylece kodlamayı kesin algılar ve
  # Türkçe karakterler (İ/ğ/Ö) servis adında bozulmaz (aksi halde ANSI sanılıyor).
  [System.IO.File]::WriteAllText($winswXml, $xml, (New-Object System.Text.UTF8Encoding($true)))

  # Idempotent: varsa eskisini düzgünce durdur + kaldır (sürüm güncellemesi).
  try { & $winswExe stop  2>$null | Out-Null } catch {}
  try { & $winswExe uninstall 2>$null | Out-Null } catch {}

  # v0.1.12'nin (görünür cmd flaşlatan) eski Scheduled Task'ını temizle.
  try { & schtasks.exe /End    /TN $id          2>$null | Out-Null } catch {}
  try { & schtasks.exe /Delete /TN $id /F        2>$null | Out-Null } catch {}

  Write-Log "${kind}: kuruluyor ($id) → port $($svc.Port)"
  $installOut = (& $winswExe install 2>&1 | Out-String).Trim()
  if ($installOut) { Write-Log "WinSW install çıktı: $installOut" }
  if ($LASTEXITCODE -ne 0) { Write-Log "${kind}: WinSW install başarısız (kod $LASTEXITCODE)"; continue }
  $startOut = (& $winswExe start 2>&1 | Out-String).Trim()
  if ($startOut) { Write-Log "WinSW start çıktı: $startOut" }
  if ($LASTEXITCODE -ne 0) { Write-Log "${kind}: WinSW start başarısız (kod $LASTEXITCODE)" }
  else { Write-Log "${kind}: çalışıyor." }
}

Write-Log "Windows Service kaydı tamamlandı."
try { Stop-Transcript | Out-Null } catch {}
exit 0
