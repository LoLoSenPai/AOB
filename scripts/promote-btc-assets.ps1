param(
  [string]$PublicRoot = (Join-Path $PSScriptRoot "..\public"),
  [string]$SourceRoot = (Join-Path $PublicRoot "_source\btc-generated\raw"),
  [string]$OutputRoot = (Join-Path $PublicRoot "assets\aob-map\btc")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$alphaThreshold = 8

$assets = @(
  @{ Source = "btc-town-center-t1.png"; Output = "buildings\btc-town-center-t1.png"; Padding = 34 },
  @{ Source = "btc-house-t1.png"; Output = "buildings\btc-house-t1.png"; Padding = 26 },
  @{ Source = "btc-barracks-t1.png"; Output = "buildings\btc-barracks-t1.png"; Padding = 30 },
  @{ Source = "btc-stable-t1.png"; Output = "buildings\btc-stable-t1.png"; Padding = 30 },
  @{ Source = "btc-watchtower-t1.png"; Output = "buildings\btc-watchtower-t1.png"; Padding = 26 },
  @{ Source = "btc-mining-camp-t1.png"; Output = "buildings\btc-mining-camp-t1.png"; Padding = 30 },
  @{ Source = "btc-forge.png"; Output = "props\btc-forge.png"; Padding = 24 },
  @{ Source = "btc-market-stall.png"; Output = "props\btc-market-stall.png"; Padding = 24 },
  @{ Source = "btc-banner.png"; Output = "props\btc-banner.png"; Padding = 20 },
  @{ Source = "btc-lantern-post.png"; Output = "props\btc-lantern-post.png"; Padding = 18 },
  @{ Source = "btc-crate-stack.png"; Output = "props\btc-crate-stack.png"; Padding = 22 },
  @{ Source = "btc-mining-cart.png"; Output = "props\btc-mining-cart.png"; Padding = 22 },
  @{ Source = "btc-stone-obelisk.png"; Output = "props\btc-stone-obelisk.png"; Padding = 18 },
  @{ Source = "btc-campfire.png"; Output = "props\btc-campfire.png"; Padding = 18 },
  @{ Source = "btc-dead-tree-stump.png"; Output = "props\btc-dead-tree-stump.png"; Padding = 18 },
  @{ Source = "btc-gold-ore-large.png"; Output = "resources\btc-gold-ore-large.png"; Padding = 24 },
  @{ Source = "btc-gold-ore-small.png"; Output = "resources\btc-gold-ore-small.png"; Padding = 20 },
  @{ Source = "btc-dark-rock-large.png"; Output = "resources\btc-dark-rock-large.png"; Padding = 24 },
  @{ Source = "btc-dark-rock-small.png"; Output = "resources\btc-dark-rock-small.png"; Padding = 20 },
  @{ Source = "btc-copper-ground-decal.png"; Output = "terrain\btc-copper-ground-decal.png"; Padding = 28 },
  @{ Source = "btc-mining-plaza-decal.png"; Output = "terrain\btc-mining-plaza-decal.png"; Padding = 28 },
  @{ Source = "btc-wall-horizontal.png"; Output = "walls\btc-wall-horizontal.png"; Padding = 20 },
  @{ Source = "btc-gate-horizontal.png"; Output = "walls\btc-gate-horizontal.png"; Padding = 20 },
  @{ Source = "btc-gate-open-horizontal.png"; Output = "walls\btc-gate-open-horizontal.png"; Padding = 20 }
)

function Get-AlphaBounds {
  param([System.Drawing.Bitmap]$Image)

  $minX = $Image.Width
  $minY = $Image.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Image.Height; $y += 1) {
    for ($x = 0; $x -lt $Image.Width; $x += 1) {
      if ($Image.GetPixel($x, $y).A -le $alphaThreshold) {
        continue
      }
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt 0) {
    return [System.Drawing.Rectangle]::new(0, 0, $Image.Width, $Image.Height)
  }

  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function Expand-Rectangle {
  param(
    [System.Drawing.Rectangle]$Rect,
    [int]$Padding,
    [int]$ImageWidth,
    [int]$ImageHeight
  )

  $x = [Math]::Max(0, $Rect.X - $Padding)
  $y = [Math]::Max(0, $Rect.Y - $Padding)
  $right = [Math]::Min($ImageWidth, $Rect.Right + $Padding)
  $bottom = [Math]::Min($ImageHeight, $Rect.Bottom + $Padding)
  return [System.Drawing.Rectangle]::new($x, $y, [Math]::Max(1, $right - $x), [Math]::Max(1, $bottom - $y))
}

function Export-CroppedPng {
  param(
    [string]$SourcePath,
    [string]$OutputPath,
    [int]$Padding
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Missing BTC source asset: $SourcePath"
  }

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $bounds = Expand-Rectangle -Rect (Get-AlphaBounds -Image $source) -Padding $Padding -ImageWidth $source.Width -ImageHeight $source.Height
    $target = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $bounds.Width, $bounds.Height), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()

    $outputParent = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
    $target.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $target.Dispose()
  }
  finally {
    $source.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

foreach ($asset in $assets) {
  $sourcePath = Join-Path $SourceRoot $asset.Source
  $outputPath = Join-Path $OutputRoot $asset.Output
  Export-CroppedPng -SourcePath $sourcePath -OutputPath $outputPath -Padding $asset.Padding
  Write-Output "Generated $outputPath"
}
