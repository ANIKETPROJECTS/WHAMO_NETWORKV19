import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

export function setupWhamoRoutes(app: any) {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const enginePath = path.join(process.cwd(), "server", "engines", "WHAMO.EXE");

  app.post("/api/generate-out", async (req: any, res: any) => {
    const { inpContent } = req.body;
    if (!inpContent) {
      return res.status(400).json({ success: false, error: "No INP content provided" });
    }

    const tempId = uuidv4();
    const runDir = path.join(tempDir, tempId);
    
    try {
      fs.mkdirSync(runDir, { recursive: true });

      // 1. Copy whamo.exe and .inp into temp directory
      const localExePath = path.join(runDir, "whamo.exe");
      const localInpPath = path.join(runDir, "input.inp");
      
      fs.copyFileSync(enginePath, localExePath);
      fs.writeFileSync(localInpPath, inpContent);

      // 2. Run wine whamo.exe
      const command = `wine whamo.exe`;
      // 3. Pass filenames via stdin
      const stdinContent = `input.inp\ninput_OUT.OUT\ninput_PLT.PLT\ninput_SHEET.TAB\n`;

      const child = exec(command, { cwd: runDir, timeout: 60000, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
          console.error("WHAMO execution error:", error);
          return res.status(500).json({
            success: false,
            error: "WHAMO execution failed",
            details: stderr || error.message
          });
        }

        // 4. Collect results as base64
        try {
          const outPath = path.join(runDir, "input_OUT.OUT");
          const pltPath = path.join(runDir, "input_PLT.PLT");
          const tabPath = path.join(runDir, "input_SHEET.TAB");

          const files: any = {};
          if (fs.existsSync(outPath)) files.out = fs.readFileSync(outPath).toString("base64");
          if (fs.existsSync(pltPath)) files.plt = fs.readFileSync(pltPath).toString("base64");
          if (fs.existsSync(tabPath)) files.tab = fs.readFileSync(tabPath).toString("base64");

          if (Object.keys(files).length === 0) {
            return res.status(500).json({ success: false, error: "No output files generated" });
          }

          res.json({ success: true, files });
        } catch (readError: any) {
          res.status(500).json({ success: false, error: "Error reading results", details: readError.message });
        } finally {
          // Cleanup
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      });

      if (child.stdin) {
        child.stdin.write(stdinContent);
        child.stdin.end();
      }
    } catch (err: any) {
      console.error("Setup error:", err);
      res.status(500).json({ success: false, error: "Internal server error", details: err.message });
      if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
    }
  });

  // Alias for backward compatibility if needed
  app.post("/api/run-whamo", (req: any, res: any) => {
    // Redirect or reuse the logic
    req.url = "/api/generate-out";
    app._router.handle(req, res);
  });
}
