param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$Title = "Technical Documentation",
  [string]$Creator = "Codex"
)

$ErrorActionPreference = "Stop"

function Escape-XmlText {
  param([string]$Value)
  if ($null -eq $Value) {
    return ""
  }
  return [System.Security.SecurityElement]::Escape($Value)
}

function New-Paragraph {
  param(
    [string]$Text,
    [bool]$Bold = $false,
    [int]$Size = 22
  )

  $escaped = Escape-XmlText -Value $Text
  $rPrParts = @()

  if ($Bold) {
    $rPrParts += "<w:b/>"
    $rPrParts += "<w:bCs/>"
  }

  if ($Size -gt 0) {
    $rPrParts += "<w:sz w:val=""$Size""/>"
    $rPrParts += "<w:szCs w:val=""$Size""/>"
  }

  $rPr = ""
  if ($rPrParts.Count -gt 0) {
    $rPr = "<w:rPr>$($rPrParts -join '')</w:rPr>"
  }

  return "<w:p><w:r>$rPr<w:t xml:space=""preserve"">$escaped</w:t></w:r></w:p>"
}

$inputResolved = Resolve-Path -Path $InputPath
$outputAbsolute = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path -Parent $outputAbsolute
if (-not [string]::IsNullOrWhiteSpace($outputDir) -and -not (Test-Path -Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$tmpRoot = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath ("docx-build-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path -Path $tmpRoot -ChildPath "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path -Path $tmpRoot -ChildPath "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path -Path $tmpRoot -ChildPath "docProps") | Out-Null

try {
  $lines = Get-Content -Path $inputResolved -Encoding UTF8
  $paras = @()
  $inCodeBlock = $false

  foreach ($line in $lines) {
    if ($line -match '^```') {
      $inCodeBlock = -not $inCodeBlock
      continue
    }

    if ([string]::IsNullOrWhiteSpace($line)) {
      $paras += "<w:p/>"
      continue
    }

    if ($inCodeBlock) {
      $paras += New-Paragraph -Text ("    " + $line) -Bold $false -Size 20
      continue
    }

    if ($line -match "^#\s+(.+)$") {
      $paras += New-Paragraph -Text $matches[1] -Bold $true -Size 36
      continue
    }
    if ($line -match "^##\s+(.+)$") {
      $paras += New-Paragraph -Text $matches[1] -Bold $true -Size 30
      continue
    }
    if ($line -match "^###\s+(.+)$") {
      $paras += New-Paragraph -Text $matches[1] -Bold $true -Size 26
      continue
    }
    if ($line -match "^[-*]\s+(.+)$") {
      $paras += New-Paragraph -Text ("• " + $matches[1]) -Bold $false -Size 22
      continue
    }
    if ($line -match "^(\d+)\.\s+(.+)$") {
      $paras += New-Paragraph -Text ($matches[1] + ". " + $matches[2]) -Bold $false -Size 22
      continue
    }

    $paras += New-Paragraph -Text $line -Bold $false -Size 22
  }

  if ($paras.Count -eq 0) {
    $paras += New-Paragraph -Text "" -Bold $false -Size 22
  }

  $documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($paras -join "`n    ")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

  $contentTypes = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

  $rels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

  $timestamp = [DateTime]::UtcNow.ToString("s") + "Z"
  $titleEscaped = Escape-XmlText -Value $Title
  $creatorEscaped = Escape-XmlText -Value $Creator

  $core = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>$titleEscaped</dc:title>
  <dc:creator>$creatorEscaped</dc:creator>
  <cp:lastModifiedBy>$creatorEscaped</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$timestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$timestamp</dcterms:modified>
</cp:coreProperties>
"@

  $app = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
"@

  Set-Content -LiteralPath (Join-Path -Path $tmpRoot -ChildPath "[Content_Types].xml") -Value $contentTypes -Encoding UTF8
  Set-Content -LiteralPath (Join-Path -Path $tmpRoot -ChildPath "_rels/.rels") -Value $rels -Encoding UTF8
  Set-Content -LiteralPath (Join-Path -Path $tmpRoot -ChildPath "word/document.xml") -Value $documentXml -Encoding UTF8
  Set-Content -LiteralPath (Join-Path -Path $tmpRoot -ChildPath "docProps/core.xml") -Value $core -Encoding UTF8
  Set-Content -LiteralPath (Join-Path -Path $tmpRoot -ChildPath "docProps/app.xml") -Value $app -Encoding UTF8

  if (Test-Path -Path $outputAbsolute) {
    Remove-Item -Path $outputAbsolute -Force
  }

  Compress-Archive -Path (Join-Path -Path $tmpRoot -ChildPath "*") -DestinationPath $outputAbsolute -Force

  Get-Item -Path $outputAbsolute | Select-Object FullName, Length
}
finally {
  if (Test-Path -Path $tmpRoot) {
    Remove-Item -Path $tmpRoot -Recurse -Force
  }
}
