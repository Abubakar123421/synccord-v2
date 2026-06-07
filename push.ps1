$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) { $gitPath = "C:\Users\abuba\AppData\Local\Programs\Git\cmd\git.exe" }

& $gitPath config --global user.name "Abubakar"
& $gitPath config --global user.email "abubakarminhas05@gmail.com"

& $gitPath init
& $gitPath remote remove origin
& $gitPath remote add origin https://github.com/Abubakar123421/synccord-v2.git
& $gitPath fetch origin
& $gitPath reset --mixed origin/main
& $gitPath add .
& $gitPath commit -m "Add YouTube video popup"
& $gitPath push origin main
