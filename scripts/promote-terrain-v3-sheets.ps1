param(
  [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $ProjectRoot "public\_source\terrain-v3\sheets"
$runtimeRoot = Join-Path $ProjectRoot "public\assets\aob-map\terrain-v3"
$cellSize = 512

$sheetSpecs = @(
  @{
    Family = "grass-dirt"
    Sheet = "grass-dirt-spritesheet.png"
    Names = @("grass", "dirt", "edge-vertical", "edge-horizontal", "corner-outer", "corner-inner")
  },
  @{
    Family = "grass-stone"
    Sheet = "grass-stone-spritesheet.png"
    Names = @("grass", "stone", "edge-vertical", "edge-horizontal", "corner-outer", "corner-inner")
  },
  @{
    Family = "shore-water"
    Sheet = "shore-water-spritesheet.png"
    Names = @("shore", "shallow-water", "edge-vertical", "edge-horizontal", "corner-outer", "corner-inner")
  }
)

foreach ($spec in $sheetSpecs) {
  $sourcePath = Join-Path $sourceRoot $spec.Sheet
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing terrain V3 spritesheet: $sourcePath"
  }

  $familyRoot = Join-Path $runtimeRoot $spec.Family
  New-Item -ItemType Directory -Force -Path $familyRoot | Out-Null

  $sourceImage = [System.Drawing.Bitmap]::new($sourcePath)
  try {
    if ($sourceImage.Width -ne ($cellSize * 3) -or $sourceImage.Height -ne ($cellSize * 2)) {
      throw "$($spec.Sheet) must be 1536x1024, got $($sourceImage.Width)x$($sourceImage.Height)"
    }

    for ($index = 0; $index -lt $spec.Names.Count; $index += 1) {
      $column = $index % 3
      $row = [Math]::Floor($index / 3)
      $rect = [System.Drawing.Rectangle]::new($column * $cellSize, $row * $cellSize, $cellSize, $cellSize)
      $tile = $sourceImage.Clone($rect, $sourceImage.PixelFormat)
      try {
        $outputPath = Join-Path $familyRoot "$($spec.Names[$index]).png"
        $tile.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $tile.Dispose()
      }
    }
  } finally {
    $sourceImage.Dispose()
  }
}

Write-Output "Promoted terrain V3 spritesheets into $runtimeRoot"
