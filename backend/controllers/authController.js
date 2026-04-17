import { getCurrentUser, loginUser, signupUser } from "../services/authService.js";

export async function signupHandler(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "name, email, phone, and password are required" });
    }

    const result = await signupUser({ name, email, phone, password });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Signup failed",
    });
  }
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await loginUser({ email, password });
    return res.json(result);
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Login failed",
    });
  }
}

export async function meHandler(req, res) {
  try {
    const user = await getCurrentUser(req.user.id);
    return res.json(user);
  } catch (error) {
    return res.status(404).json({
      error: error instanceof Error ? error.message : "User not found",
    });
  }
}
