const bcrypt = require("bcryptjs");
const axios = require("axios");
const SibApiV3Sdk = require("sib-api-v3-sdk");

// controllers/authController.js

const User = require("../models/user");

// ================= BREVO API CONFIG =================

const defaultClient = SibApiV3Sdk.ApiClient.instance;

defaultClient.authentications["api-key"].apiKey =
  process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Generate random OTP (4 digits)
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000);
};

// Check email
const isEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

// Check phone number
const isPhone = (value) => {
  return /^[0-9]{10}$/.test(value);
};

// ================= SEND EMAIL OTP =================

const sendEmailOTP = async (email, otp, subjectText) => {
  await apiInstance.sendTransacEmail({
    sender: {
      email: process.env.BREVO_FROM_EMAIL,
      name: "GiftSky",
    },

    to: [
      {
        email: email,
      },
    ],

    subject: subjectText,

    htmlContent: `
      <h2>Welcome to GiftSky</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>Valid for 5 minutes.</p>
    `,
  });
};

// ================= SIGNUP API =================

exports.signup = async (req, res) => {
  try {
    const { name, phone_email, password } = req.body;

    console.log(JSON.stringify(req.body));

    // Validation
    if (!name || !phone_email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone/email and password are required",
      });
    }

    // Check Existing User
    const existingUser = await User.findOne({
      where: { phone_email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Phone/Email already registered",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Create User
    const user = await User.create({
      name,
      phone_email,
      password,
      otp,
    });

    // ================= SEND OTP =================

    try {
      // ---------- EMAIL OTP ----------
      if (isEmail(phone_email)) {
        await sendEmailOTP(
          phone_email,
          otp,
          "GiftSky OTP Verification"
        );

        console.log(`📧 OTP sent to Email: ${phone_email}`);
      }

      // ---------- PHONE OTP ----------
      else if (isPhone(phone_email)) {
        const phone = `+91${phone_email}`;

        await axios.post(
          process.env.TWILIO_AXIOS,

          new URLSearchParams({
            To: phone,
            From: "+17016454807",
            Body: `Your GiftSky OTP is ${otp}`,
          }),

          {
            auth: {
              username: process.env.TWILIO_USERNAME,
              password: process.env.TWILIO_PASSWORD,
            },

            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        console.log(`📱 OTP sent to Phone: ${phone}`);
      }

      // Invalid Input
      else {
        return res.status(400).json({
          success: false,
          message: "Enter valid Email or 10 digit Phone Number",
        });
      }
    } catch (otpError) {
      console.error("OTP Sending Error:", otpError);

      return res.status(500).json({
        success: false,
        message: "OTP sending failed",
        error: otpError.message,
      });
    }

    // ================= RESPONSE =================

    res.status(201).json({
      success: true,
      message: "Signup successful. User created successfully.",
      data: {
        userId: user.id,
        name: user.name,
        phone_email: user.phone_email,
      },
    });
  } catch (error) {
    console.error("Signup Error:", error);

    res.status(500).json({
      success: false,
      message: "Signup failed",
      error: error.message,
    });
  }
};

// ================= LOGIN API =================

exports.login = async (req, res) => {
  try {
    const { phone_email, password } = req.body;

    // Validation
    if (!phone_email || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone/email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({
      where: { phone_email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.id,
        name: user.name,
        phone_email: user.phone_email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// ================= VERIFY OTP API =================

exports.verifyOTP = async (req, res) => {
  try {
    const { phone_email, otp } = req.body;

    // Validation
    if (!phone_email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone/Email and OTP are required",
      });
    }

    // Find user
    const user = await User.findOne({
      where: { phone_email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check OTP
    if (user.otp != otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Clear OTP
    user.otp = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        userId: user.id,
        name: user.name,
        phone_email: user.phone_email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: error.message,
    });
  }
};

// ================= RESEND OTP API =================

exports.resendOTP = async (req, res) => {
  try {
    const { phone_email } = req.body;

    // Validation
    if (!phone_email) {
      return res.status(400).json({
        success: false,
        message: "Phone/Email is required",
      });
    }

    // Find User
    const user = await User.findOne({
      where: { phone_email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate New OTP
    const otp = generateOTP();

    // Save OTP
    user.otp = otp;
    await user.save();

    // ---------- EMAIL OTP ----------
    if (isEmail(phone_email)) {
      await sendEmailOTP(
        phone_email,
        otp,
        "GiftSky OTP Resend"
      );

      console.log(`📧 OTP resent to Email: ${phone_email}`);
    }

    // ---------- PHONE OTP ----------
    else if (isPhone(phone_email)) {
      const phone = `+91${phone_email}`;

      await axios.post(
        process.env.TWILIO_AXIOS,

        new URLSearchParams({
          To: phone,
          From: "+17016454807",
          Body: `Your new GiftSky OTP is ${otp}`,
        }),

        {
          auth: {
            username: process.env.TWILIO_USERNAME,
            password: process.env.TWILIO_PASSWORD,
          },

          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log(`📱 OTP resent to Phone: ${phone}`);
    }

    // Invalid Input
    else {
      return res.status(400).json({
        success: false,
        message: "Enter valid Email or 10 digit Phone Number",
      });
    }

    // Response
    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);

    res.status(500).json({
      success: false,
      message: "Resend OTP failed",
      error: error.message,
    });
  }
};

// ================= GOOGLE SIGN IN API =================

exports.googleSignIn = async (req, res) => {
  try {
    const { name, phone_email, googleId } = req.body;

    console.log(JSON.stringify(req.body));

    // Validation
    if (!name || !phone_email || !googleId) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and Google ID are required",
      });
    }

    // Check Existing User
    let user = await User.findOne({
      where: { phone_email },
    });

    if (user) {
      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          userId: user.id,
          name: user.name,
          phone_email: user.phone_email,
        },
      });
    }

    // Create User
    user = await User.create({
      name,
      phone_email,
      password: null,
      otp: null,
    });

    res.status(201).json({
      success: true,
      message: "Account created and logged in via Google",
      data: {
        userId: user.id,
        name: user.name,
        phone_email: user.phone_email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Google Sign In failed",
      error: error.message,
    });
  }
};