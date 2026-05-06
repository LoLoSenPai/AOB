param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$InsetPixels = 4
)

Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $ProjectRoot "public\_source\editor-tilesets\set-2\raw"
$outputRoot = Join-Path $ProjectRoot "public\assets\editor\gpt-set-2"
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$specs = @(
  @{ Source = "set-2-a-raw.png"; Output = "set-2-a-clean.png"; Columns = 8; Rows = 6 },
  @{ Source = "set-2-b-raw.png"; Output = "set-2-b-clean.png"; Columns = 8; Rows = 6 }
)

foreach ($spec in $specs) {
  $sourcePath = Join-Path $sourceRoot $spec.Source
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing source tileset: $sourcePath"
  }

  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $columns = [int]$spec.Columns
    $rows = [int]$spec.Rows
    $sourceCellWidth = [int]($source.Width / $columns)
    $sourceCellHeight = [int]($source.Height / $rows)
    if (($sourceCellWidth * $columns) -ne $source.Width -or ($sourceCellHeight * $rows) -ne $source.Height) {
      throw "$($spec.Source) is not evenly divisible by $columns x $rows ($($source.Width)x$($source.Height))."
    }
    if ($sourceCellWidth -ne $sourceCellHeight) {
      throw "$($spec.Source) cells are not square ($sourceCellWidth x $sourceCellHeight)."
    }

    $tileSize = 32
    $output = New-Object System.Drawing.Bitmap ($columns * $tileSize), ($rows * $tileSize), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($output)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

        for ($row = 0; $row -lt $rows; $row += 1) {
          for ($column = 0; $column -lt $columns; $column += 1) {
            $srcRect = [System.Drawing.Rectangle]::new(
              ($column * $sourceCellWidth + $InsetPixels),
              ($row * $sourceCellHeight + $InsetPixels),
              ($sourceCellWidth - ($InsetPixels * 2)),
              ($sourceCellHeight - ($InsetPixels * 2))
            )
            $dstRect = [System.Drawing.Rectangle]::new(($column * $tileSize), ($row * $tileSize), $tileSize, $tileSize)
            $graphics.DrawImage($source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
          }
        }
      } finally {
        $graphics.Dispose()
      }

      $outputPath = Join-Path $outputRoot $spec.Output
      $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output "$($spec.Output): $columns x $rows cells, $sourceCellWidth px raw cell, $InsetPixels px inset -> $tileSize px runtime cell"
    } finally {
      $output.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}
