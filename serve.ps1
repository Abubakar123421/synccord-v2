$port = 8080
$folder = Resolve-Path "web"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server started." -ForegroundColor Green
Write-Host "Open your browser to: http://localhost:$port" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
        
        # Prevent directory traversal
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $folder $localPath))
        
        if ($filePath.StartsWith($folder.Path) -and (Test-Path $filePath -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".json" { $contentType = "application/json" }
            }
            $response.ContentType = $contentType
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            # Fallback to index.html for SPA routing (like Vercel does)
            $fallbackPath = Join-Path $folder "index.html"
            if (Test-Path $fallbackPath -PathType Leaf) {
                $response.ContentType = "text/html; charset=utf-8"
                $content = [System.IO.File]::ReadAllBytes($fallbackPath)
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
            } else {
                $response.StatusCode = 404
            }
        }
        $response.Close()
    }
} catch {
    Write-Host "Server stopped." -ForegroundColor Yellow
} finally {
    if ($listener.IsListening) { $listener.Stop() }
}
