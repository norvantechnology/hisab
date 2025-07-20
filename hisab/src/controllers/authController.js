import crypto from "crypto"; 
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import pool from "../config/dbConnection.js";
import { generateToken, sendOtpEmail, errorResponse, successResponse } from "../utils/index.js";

export async function signup(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return errorResponse(res, "Name, email and password are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUserQuery = `SELECT id FROM hisab."users" WHERE email = $1 LIMIT 1`;
    const existingUser = await client.query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Email already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const insertUserQuery = `
      INSERT INTO hisab."users"
      ("name", "email", "password", "role", "isActive", "createdAt", "updatedAt", "isVerified", "verificationToken", "verificationTokenExpiry")
      VALUES ($1, $2, $3, 'user', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, $4, NOW() + INTERVAL '1 day')
      RETURNING id, "name", "email", "role", "isActive", "isVerified", "createdAt", "updatedAt"
    `;

    const newUser = await client.query(insertUserQuery, [
      name,
      email,
      hashedPassword,
      verificationToken,
    ]);

    const token = generateToken(newUser.rows[0]);

    await client.query("COMMIT");

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const templatePath = path.join(process.cwd(), "src/templates/email_verification_template.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate
      .replace(/\[Client Name\]/g, name)
      .replace(/{{VERIFICATION_LINK}}/g, verificationUrl);

    const emailOptions = {
      subject: `Please verify your email for Exellius`,
      text: `Hi ${name},\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.`,
      html: htmlTemplate,
    };

    sendOtpEmail(email, emailOptions).catch(error =>
      console.error("Failed to send verification email:", error)
    );

    return successResponse(res, {
      message: "Signup successful, verification email sent",
      token,
      user: newUser.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error during signup", 500);
  } finally {
    client.release();
  }
}

export async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return errorResponse(res, "Verification token is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const query = `
      SELECT id, "verificationTokenExpiry", "isVerified"
      FROM hisab."users"
      WHERE "verificationToken" = $1
      LIMIT 1
    `;
    const result = await client.query(query, [token]);

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Invalid verification token", 400);
    }

    const user = result.rows[0];

    if (user.isVerified) {
      await client.query("ROLLBACK");
      return successResponse(res, "Email already verified");
    }

    if (new Date() > new Date(user.verificationTokenExpiry)) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Verification token expired. Please request a new verification email.", 400);
    }

    const updateQuery = `
      UPDATE hisab."users"
      SET "isVerified" = TRUE,
          "verificationToken" = NULL,
          "verificationTokenExpiry" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await client.query(updateQuery, [user.id]);

    await client.query("COMMIT");

    return successResponse(res, "Email verified successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error verifying email", 500);
  } finally {
    client.release();
  }
}


export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, "Email and password are required", 400);
  }

  const client = await pool.connect();

  try {
    const userQuery = `
      SELECT id, "name", "email", "password", "role", "isVerified", "isActive"
      FROM hisab."users"
      WHERE "email" = $1
      LIMIT 1
    `;
    const result = await client.query(userQuery, [email]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, "Your account has been deactivated. Please contact support.", 403);
    }

    // Check if email is verified
    if (!user.isVerified) {
      return errorResponse(res, "Please verify your email before logging in.", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    // Remove sensitive data
    delete user.password;

    const token = generateToken(user);

    return successResponse(res, {
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error during login", 500);
  } finally {
    client.release();
  }
}