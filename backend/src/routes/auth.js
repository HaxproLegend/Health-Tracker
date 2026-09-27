import { Router } from "express";
import bcrypt from "bcryptjs";
import pool, { withRetry } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();
const SALT_ROUNDS = 12;

router.post("/register", async (req, res) => {
  const { username, password, age, gender, height_cm, target_weight } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await withRetry(() =>
      pool.query(
        `INSERT INTO users (username, password_hash, age, gender, height_cm, target_weight)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, passwordHash, age ?? null, gender ?? null, height_cm ?? null, target_weight ?? null]
      )
    );

    const token = signToken({ id: result.insertId, username });
    return res.status(201).json({
      token,
      user: { id: result.insertId, username, age, gender, height_cm, target_weight },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username is already taken" });
    }
    console.error("Register error:", err);
    return res.status(500).json({ error: "Could not register user" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const [rows] = await withRetry(() =>
      pool.query("SELECT * FROM users WHERE username = ?", [username])
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Could not log in" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await withRetry(() =>
      pool.query(
        "SELECT id, username, age, gender, height_cm, target_weight, created_at FROM users WHERE id = ?",
        [req.user.id]
      )
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("Fetch profile error:", err);
    return res.status(500).json({ error: "Could not fetch profile" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  const { age, gender, height_cm, target_weight } = req.body;
  const fields = [];
  const values = [];

  for (const [column, value] of Object.entries({ age, gender, height_cm, target_weight })) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return res.json({ message: "Nothing to update" });

  values.push(req.user.id);
  try {
    await withRetry(() => pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values));
    return res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Could not update profile" });
  }
});

export default router;
