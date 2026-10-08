param(
  [Parameter(Mandatory = $true)][string]$Stage,
  [string]$Voice = 'Microsoft Ayumi',
  [string]$Overrides = '',
  [string]$RateOverrides = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$root = Split-Path -Parent $PSScriptRoot
$stagePath = [System.IO.Path]::GetFullPath($Stage)
New-Item -ItemType Directory -Force -Path $stagePath | Out-Null
$checkpointPath = Join-Path $stagePath 'checkpoint.json'
$checkpoint = if (Test-Path -LiteralPath $checkpointPath) { Get-Content -LiteralPath $checkpointPath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
$overrideMap = if ($Overrides) { Get-Content -LiteralPath $Overrides -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
$rateMap = if ($RateOverrides) { Get-Content -LiteralPath $RateOverrides -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
$kanaManifest = Get-Content -LiteralPath (Join-Path $root 'audio\manifest.json') -Raw | ConvertFrom-Json
$courseManifest = Get-Content -LiteralPath (Join-Path $root 'audio\course-manifest.json') -Raw | ConvertFrom-Json
$entries = @($kanaManifest | Where-Object { $_.file -like 'special-*.mp3' }) + @($courseManifest | Where-Object { $_.file -match '-v\d+\.mp3$|-q[48]\.mp3$' })
$cache = @{}
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$synth.SelectVoice($Voice)
$synth.Rate = 0
try {
  foreach ($entry in $entries) {
    $text = if ($overrideMap.ContainsKey($entry.file)) { [string]$overrideMap[$entry.file] } else { [string]$entry.kana }
    $rate = if ($rateMap.ContainsKey($entry.file)) { [int]$rateMap[$entry.file] } else { 0 }
    if ($rate -lt -10 -or $rate -gt 10) { throw "invalid speech rate for $($entry.file)" }
    $signature = "$Voice`n$rate`n$text"
    $target = Join-Path $stagePath $entry.file
    $saved = $checkpoint[$entry.file]
    if ($saved -and $saved.signature -eq $signature -and (Test-Path -LiteralPath $target)) {
      $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($hash -eq $saved.sha256) {
        $cache[$signature] = $target
        Write-Output "keep $($entry.file)"
        continue
      }
    }
    if ($cache.ContainsKey($signature) -and (Test-Path -LiteralPath $cache[$signature])) {
      Copy-Item -LiteralPath $cache[$signature] -Destination $target -Force
    } else {
      $wav = Join-Path $stagePath '_current.wav'
      if (Test-Path -LiteralPath $wav) { Remove-Item -LiteralPath $wav }
      $synth.Rate = $rate
      $synth.SetOutputToWaveFile($wav)
      $synth.Speak($text)
      $synth.SetOutputToNull()
      & ffmpeg -hide_banner -loglevel error -y -i $wav -af 'loudnorm=I=-18:TP=-2:LRA=7' -codec:a libmp3lame -q:a 4 $target
      if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($entry.file)" }
      Remove-Item -LiteralPath $wav
      $cache[$signature] = $target
    }
    $seconds = [double](& ffprobe -v error -show_entries format=duration -of 'default=noprint_wrappers=1:nokey=1' $target)
    if ($LASTEXITCODE -ne 0 -or $seconds -lt 0.2 -or $seconds -gt 10 -or (Get-Item -LiteralPath $target).Length -lt 1000) { throw "invalid audio for $($entry.file)" }
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifest = if ($entry.file -like 'special-*.mp3') { 'manifest.json' } else { 'course-manifest.json' }
    $checkpoint[$entry.file] = @{ file = $entry.file; kana = $entry.kana; manifest = $manifest; synthesis_text = $text; signature = $signature; rate = $rate; seconds = [math]::Round($seconds, 3); sha256 = $hash; engine = 'windows-sapi5'; voice = $Voice }
    $checkpoint | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $checkpointPath -Encoding utf8
    Write-Output "$($checkpoint.Count)/$($entries.Count) $($entry.file) $text"
  }
} finally {
  $synth.Dispose()
}
