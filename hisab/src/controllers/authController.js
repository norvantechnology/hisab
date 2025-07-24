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

    const existingUserQuery = `SELECT id, "name", "isVerified", "verificationToken" FROM hisab."users" WHERE email = $1 LIMIT 1`;
    const existingUser = await client.query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      
      // If user is already verified, return error
      if (user.isVerified) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Email already in use");
      }
      
      // If user is not verified, generate new verification token and resend email
      const newVerificationToken = crypto.randomBytes(32).toString("hex");
      
      const updateUserQuery = `
        UPDATE hisab."users"
        SET "name" = $1, "password" = $2, "verificationToken" = $3, "verificationTokenExpiry" = NOW() + INTERVAL '1 day', "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, "name", "email", "role", "isActive", "isVerified", "createdAt", "updatedAt"
      `;
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const updatedUser = await client.query(updateUserQuery, [
        name,
        hashedPassword,
        newVerificationToken,
        user.id
      ]);

      const token = generateToken(updatedUser.rows[0]);

      await client.query("COMMIT");

      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${newVerificationToken}`;

      const templatePath = path.join(process.cwd(), "src/templates/email_verification_template.html");
      let htmlTemplate = fs.readFileSync(templatePath, "utf8");

      htmlTemplate = htmlTemplate
        .replace("[Client Name]", name)
        .replace("{{VERIFICATION_LINK}}", verificationUrl);

      console.log("htmlTemplate", htmlTemplate);
      
      try {
        let emailSent = await sendOtpEmail(email, {
          subject: "Email Verification",
          html: htmlTemplate
        });

        if (!emailSent) {
          return errorResponse(res, "Failed to send verification email", 500);
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return errorResponse(res, "Failed to send verification email. Please try again.", 500);
      }

      return successResponse(res, {
        message: "Verification email resent successfully. Please check your email for verification.",
        token,
        user: {
          id: updatedUser.rows[0].id,
          name: updatedUser.rows[0].name,
          email: updatedUser.rows[0].email,
          role: updatedUser.rows[0].role,
        },
      });
    }

    // If no existing user, create new user
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
        .replace("[Client Name]", name)
        .replace("{{VERIFICATION_LINK}}", verificationUrl);

      console.log("htmlTemplate", htmlTemplate);
      
      try {
        let emailSent = await sendOtpEmail(email, {
          subject: "Email Verification",
          html: htmlTemplate
        });

        if (!emailSent) {
          return errorResponse(res, "Failed to send verification email", 500);
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return errorResponse(res, "Failed to send verification email. Please try again.", 500);
      }

    return successResponse(res, {
      message: "User registered successfully. Please check your email for verification.",
      token,
      user: {
        id: newUser.rows[0].id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role,
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Signup error:", error);
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
    const userQuery = `
      SELECT id, "name", "email", "isVerified", "verificationTokenExpiry"
      FROM hisab."users"
      WHERE "verificationToken" = $1 AND "isVerified" = FALSE
      LIMIT 1
    `;
    const result = await client.query(userQuery, [token]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Invalid or expired verification token", 400);
    }

    const user = result.rows[0];

    // Check if token is expired
    if (new Date() > new Date(user.verificationTokenExpiry)) {
      return errorResponse(res, "Verification token has expired", 400);
    }

    // Update user as verified
    await client.query(
      `UPDATE hisab."users" 
       SET "isVerified" = TRUE, "verificationToken" = NULL, "verificationTokenExpiry" = NULL, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    return successResponse(res, {
      message: "Email verified successfully. You can now login.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Email verification error:", error);
    return errorResponse(res, "Error during email verification", 500);
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

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const { id: userId } = req.currentUser || {};

  if (!userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!currentPassword || !newPassword) {
    return errorResponse(res, "Current password and new password are required", 400);
  }

  if (newPassword.length < 8) {
    return errorResponse(res, "New password must be at least 8 characters long", 400);
  }

  const client = await pool.connect();

  try {
    // Get current user with password
    const userQuery = `
      SELECT id, "name", "email", "password"
      FROM hisab."users"
      WHERE id = $1 AND "isActive" = TRUE
      LIMIT 1
    `;
    const result = await client.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return errorResponse(res, "User not found", 404);
    }

    const user = result.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, "Current password is incorrect", 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await client.query(
      `UPDATE hisab."users" 
       SET "password" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedNewPassword, userId]
    );

    return successResponse(res, {
      message: "Password changed successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Password change error:", error);
    return errorResponse(res, "Error changing password", 500);
  } finally {
    client.release();
  }
}

export async function resendVerificationEmail(req, res) {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, "Email is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userQuery = `SELECT id, "name", "isVerified" FROM hisab."users" WHERE email = $1 LIMIT 1`;
    const user = await client.query(userQuery, [email]);

    if (user.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "User not found");
    }

    const userData = user.rows[0];

    if (userData.isVerified) {
      await client.query("ROLLBACK");
      return errorResponse(res, "User is already verified");
    }

    // Generate new verification token
    const newVerificationToken = crypto.randomBytes(32).toString("hex");
    
    const updateUserQuery = `
      UPDATE hisab."users"
      SET "verificationToken" = $1, "verificationTokenExpiry" = NOW() + INTERVAL '1 day', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await client.query(updateUserQuery, [newVerificationToken, userData.id]);

    await client.query("COMMIT");

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${newVerificationToken}`;

    const templatePath = path.join(process.cwd(), "src/templates/email_verification_template.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate
      .replace("[Client Name]", userData.name)
      .replace("{{VERIFICATION_LINK}}", verificationUrl);

    console.log("htmlTemplate", htmlTemplate);
    
    try {
      let emailSent = await sendOtpEmail(email, {
        subject: "Email Verification",
        html: htmlTemplate
      });

      if (!emailSent) {
        return errorResponse(res, "Failed to send verification email", 500);
      }
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return errorResponse(res, "Failed to send verification email. Please try again.", 500);
    }

    return successResponse(res, {
      message: "Verification email sent successfully. Please check your email for verification.",
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Resend verification email error:", error);
    return errorResponse(res, "Error sending verification email", 500);
  } finally {
    client.release();
  }
}