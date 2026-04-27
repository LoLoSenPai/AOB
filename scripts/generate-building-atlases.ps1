param(
  [string]$PublicRoot = (Join-Path $PSScriptRoot "..\public"),
  [string]$SourceRoot = (Join-Path $PublicRoot "_source\aob-buildings\raw"),
  [string]$OutputRoot = (Join-Path $PublicRoot "assets\aob-buildings\static-runtime")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$frameSize = 512
$alphaThreshold = 12
$targetAnchorX = [int]($frameSize / 2)
$targetBaselineY = 476
$targetPadding = 18

$sources = @(
  @{ Type = "town-center"; Source = "hdv.png"; Tiers = 3 },
  @{ Type = "house"; Source = "house.png"; Tiers = 3 },
  @{ Type = "lumber-camp"; Source = "lumber-camp.png"; Tiers = 2 },
  @{ Type = "mill"; Source = "food.png"; Tiers = 3 },
  @{ Type = "stone-camp"; Source = "stone-camp.png"; Tiers = 2 },
  @{ Type = "gold-camp"; Source = "cristal-camp.png"; Tiers = 3 },
  @{ Type = "farm"; Source = "farm.png"; Tiers = 3 },
  @{ Type = "barracks"; Source = "barrack.png"; Tiers = 3 },
  @{ Type = "watch-tower"; Source = "tower.png"; Tiers = 3 }
)

function Get-OpaqueBounds {
  param(
    [System.Drawing.Bitmap]$Image,
    [int]$StartX,
    [int]$EndX
  )

  $minX = $Image.Width
  $minY = $Image.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = $StartX; $x -le $EndX; $x++) {
      $pixel = $Image.GetPixel($x, $y)
      if ($pixel.A -le $alphaThreshold) {
        continue
      }

      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt 0) {
    return $null
  }

  return [pscustomobject]@{
    MinX = $minX
    MinY = $minY
    MaxX = $maxX
    MaxY = $maxY
    Width = $maxX - $minX + 1
    Height = $maxY - $minY + 1
  }
}

function Get-SpriteBands {
  param([System.Drawing.Bitmap]$Image)

  $columns = New-Object System.Collections.Generic.List[int]
  for ($x = 0; $x -lt $Image.Width; $x++) {
    $hasPixel = $false
    for ($y = 0; $y -lt $Image.Height; $y++) {
      if ($Image.GetPixel($x, $y).A -gt $alphaThreshold) {
        $hasPixel = $true
        break
      }
    }
    if ($hasPixel) {
      $columns.Add($x)
    }
  }

  if ($columns.Count -eq 0) {
    return @()
  }

  $bands = New-Object System.Collections.Generic.List[object]
  $start = $columns[0]
  $previous = $columns[0]
  for ($i = 1; $i -lt $columns.Count; $i++) {
    $x = $columns[$i]
    if (($x - $previous) -gt 18) {
      $bands.Add([pscustomobject]@{ Start = $start; End = $previous }) | Out-Null
      $start = $x
    }
    $previous = $x
  }
  $bands.Add([pscustomobject]@{ Start = $start; End = $previous }) | Out-Null

  return @($bands | Where-Object { ($_.End - $_.Start + 1) -gt 32 } | Sort-Object Start)
}

function Get-ScaleForBounds {
  param([object[]]$Bounds)

  $maxLeft = 1.0
  $maxRight = 1.0
  $maxHeight = 1.0
  foreach ($bound in $Bounds) {
    if (-not $bound) {
      continue
    }
    $center = ($bound.MinX + $bound.MaxX) / 2.0
    $left = $center - $bound.MinX
    $right = $bound.MaxX - $center
    if ($left -gt $maxLeft) { $maxLeft = $left }
    if ($right -gt $maxRight) { $maxRight = $right }
    if ($bound.Height -gt $maxHeight) { $maxHeight = $bound.Height }
  }

  $availableLeft = $targetAnchorX - $targetPadding
  $availableRight = $frameSize - $targetAnchorX - $targetPadding
  $availableHeight = $targetBaselineY - $targetPadding
  return [Math]::Min([Math]::Min($availableLeft / $maxLeft, $availableRight / $maxRight), $availableHeight / $maxHeight)
}

function Export-NormalizedSprite {
  param(
    [System.Drawing.Bitmap]$Source,
    [object]$Bounds,
    [double]$Scale,
    [string]$OutputPath
  )

  $target = [System.Drawing.Bitmap]::new($frameSize, $frameSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy

  $sourceRect = [System.Drawing.Rectangle]::new($Bounds.MinX, $Bounds.MinY, $Bounds.Width, $Bounds.Height)
  $destWidth = [int][Math]::Max(1, [Math]::Round($Bounds.Width * $Scale))
  $destHeight = [int][Math]::Max(1, [Math]::Round($Bounds.Height * $Scale))
  $sourceCenter = ($Bounds.MinX + $Bounds.MaxX) / 2.0
  $anchorOffsetX = ($sourceCenter - $Bounds.MinX) * $Scale
  $destX = [int][Math]::Round($targetAnchorX - $anchorOffsetX)
  $destY = [int][Math]::Round($targetBaselineY - $destHeight)
  $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $destWidth, $destHeight)

  $graphics.DrawImage($Source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  $target.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $target.Dispose()
}

function Build-TieredSprites {
  param([hashtable]$SourceConfig)

  $sourcePath = Join-Path $SourceRoot $SourceConfig.Source
  if (-not (Test-Path $sourcePath)) {
    throw "Missing source image: $sourcePath"
  }

  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $bands = @(Get-SpriteBands -Image $source)
  $requestedTiers = [int]$SourceConfig.Tiers
  if ($bands.Count -lt $requestedTiers) {
    throw "Expected at least $requestedTiers sprite bands in $sourcePath, found $($bands.Count)."
  }

  $bands = @($bands | Select-Object -First $requestedTiers)
  $bounds = @()
  foreach ($band in $bands) {
    $bounds += Get-OpaqueBounds -Image $source -StartX $band.Start -EndX $band.End
  }

  $scale = Get-ScaleForBounds -Bounds $bounds
  for ($tier = 1; $tier -le 3; $tier++) {
    $sourceTier = [Math]::Min($tier, $requestedTiers)
    $outputPath = Join-Path $OutputRoot "$($SourceConfig.Type)-t$tier.png"
    Export-NormalizedSprite -Source $source -Bounds $bounds[$sourceTier - 1] -Scale $scale -OutputPath $outputPath
    Write-Output "Generated $outputPath"
  }

  $source.Dispose()
}

function Build-ConstructionSprite {
  $sourcePath = Join-Path $SourceRoot "construction.png"
  if (-not (Test-Path $sourcePath)) {
    throw "Missing construction image: $sourcePath"
  }

  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $bounds = Get-OpaqueBounds -Image $source -StartX 0 -EndX ($source.Width - 1)
  $scale = Get-ScaleForBounds -Bounds @($bounds)
  $outputPath = Join-Path $OutputRoot "construction.png"
  Export-NormalizedSprite -Source $source -Bounds $bounds -Scale $scale -OutputPath $outputPath
  $source.Dispose()
  Write-Output "Generated $outputPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

foreach ($source in $sources) {
  Build-TieredSprites -SourceConfig $source
}
Build-ConstructionSprite
