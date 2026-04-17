import { initializeBackend } from "./app.js";

const port = process.env.PORT || 4000;

initializeBackend()
  .then((app) => {
    app.listen(port, () => {
      console.log(`RouteWise backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });
