using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;

namespace OrbixStudio
{
    static class Program
    {
        private static HttpListener _listener;
        private static string _baseDir;
        private static volatile bool _running = true;

        [STAThread]
        static void Main()
        {
            try
            {
                _baseDir = AppDomain.CurrentDomain.BaseDirectory;
                
                // If run from a subfolder, walk up to find index.html
                if (!File.Exists(Path.Combine(_baseDir, "index.html")) && File.Exists(Path.Combine(_baseDir, "..", "index.html")))
                {
                    _baseDir = Path.GetFullPath(Path.Combine(_baseDir, ".."));
                }

                int port = GetAvailablePort();
                string prefix = string.Format("http://127.0.0.1:{0}/", port);

                _listener = new HttpListener();
                _listener.Prefixes.Add(prefix);
                _listener.Start();

                Thread serverThread = new Thread(RunServer);
                serverThread.IsBackground = true;
                serverThread.Start();

                string browserExe = FindChromiumBrowser();
                if (string.IsNullOrEmpty(browserExe))
                {
                    MessageBox.Show(
                        "Microsoft Edge or Google Chrome was not found on this system.\n\nPlease install Microsoft Edge or Chrome to run Orbix Studio with hardware GPU acceleration.",
                        "Orbix Studio CAD",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OrbixStudio", "BrowserProfile");
                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }

                string url = string.Format("http://127.0.0.1:{0}/index.html", port);
                string args = string.Format(
                    "--app=\"{0}\" --start-maximized --window-size=1600,1000 --user-data-dir=\"{1}\" --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --enable-webgl2-compute-context --high-dpi-support=1",
                    url,
                    profileDir
                );

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browserExe;
                psi.Arguments = args;
                psi.UseShellExecute = false;

                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit();
                }

                _running = false;
                try { _listener.Stop(); } catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error starting Orbix Studio: " + ex.Message, "Orbix Studio CAD", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static int GetAvailablePort()
        {
            TcpListener l = new TcpListener(IPAddress.Loopback, 0);
            l.Start();
            int port = ((IPEndPoint)l.LocalEndpoint).Port;
            l.Stop();
            return port;
        }

        private static string FindChromiumBrowser()
        {
            string[] candidatePaths = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string path in candidatePaths)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        private static void RunServer()
        {
            while (_running && _listener.IsListening)
            {
                try
                {
                    HttpListenerContext context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(ProcessRequest, context);
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        private static void ProcessRequest(object state)
        {
            HttpListenerContext context = (HttpListenerContext)state;
            try
            {
                string rawUrl = context.Request.Url.AbsolutePath;
                if (string.IsNullOrEmpty(rawUrl) || rawUrl == "/")
                {
                    rawUrl = "/index.html";
                }

                rawUrl = rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                string filePath = Path.Combine(_baseDir, rawUrl);

                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLowerInvariant();

                    string mime = "application/octet-stream";
                    if (ext == ".html" || ext == ".htm") mime = "text/html; charset=utf-8";
                    else if (ext == ".js") mime = "application/javascript; charset=utf-8";
                    else if (ext == ".css") mime = "text/css; charset=utf-8";
                    else if (ext == ".json") mime = "application/json; charset=utf-8";
                    else if (ext == ".png") mime = "image/png";
                    else if (ext == ".jpg" || ext == ".jpeg") mime = "image/jpeg";
                    else if (ext == ".svg") mime = "image/svg+xml";
                    else if (ext == ".gif") mime = "image/gif";
                    else if (ext == ".woff2") mime = "font/woff2";
                    else if (ext == ".woff") mime = "font/woff";
                    else if (ext == ".ttf") mime = "font/ttf";

                    context.Response.ContentType = mime;
                    context.Response.ContentLength64 = data.Length;
                    context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    context.Response.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    context.Response.StatusCode = 404;
                    byte[] notFound = System.Text.Encoding.UTF8.GetBytes("404 Not Found");
                    context.Response.OutputStream.Write(notFound, 0, notFound.Length);
                }
            }
            catch { }
            finally
            {
                try { context.Response.OutputStream.Close(); } catch { }
            }
        }
    }
}

