const { execSync } = require('child_process');

function tryCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    console.log('OK:', cmd, '->', out.trim());
  } catch (e) {
    console.log('FAIL:', cmd, '-> status:', e.status);
  }
}

tryCmd('"C:\\Program Files\\Git\\bin\\bash.exe" -c "echo hello"');
tryCmd('"C:\\Program Files\\Git\\cmd\\git.exe" --version');
tryCmd('"C:\\Program Files\\Git\\ucrt64\\bin\\git.exe" --version');

