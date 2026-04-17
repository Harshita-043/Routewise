import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "routewise-dev-secret";
const TOKEN_EXPIRES_IN = "7d";

function buildAuthUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN },
  );
}

export async function signupUser({ name, email, phone, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    phone,
    passwordHash,
    bookings: [],
  });

  return {
    token: signToken(user),
    user: buildAuthUser(user),
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  return {
    token: signToken(user),
    user: buildAuthUser(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId).select("_id name email phone");

  if (!user) {
    throw new Error("User not found");
  }

  return buildAuthUser(user);
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
