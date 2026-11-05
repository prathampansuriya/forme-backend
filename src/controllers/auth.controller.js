import authService from '../services/auth.service.js';
import tokenService from '../services/token.service.js';
import mediaService from '../services/media.service.js';
import ApplicationError from '../utils/ApplicationError.js';
import jwtConfig from '../config/jwt.config.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// Helper to set refresh token cookie
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, jwtConfig.cookieOptions);
};

// Helper to clear refresh token cookie
const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: jwtConfig.cookieOptions.secure,
    sameSite: jwtConfig.cookieOptions.sameSite,
    path: jwtConfig.cookieOptions.path,
  });
};

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerCustomer(req.body);
  return apiResponse.created(res, {
    message: result.message,
    data: result,
  });
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  const result = await authService.verifyEmailOTP({
    email: req.body.email,
    otp: req.body.otp,
    deviceInfo,
    ipAddress,
  });

  setRefreshTokenCookie(res, result.refreshToken);

  return apiResponse.success(res, {
    message: 'Email verified successfully. Welcome to FORME.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const resendOTP = asyncHandler(async (req, res) => {
  const result = await authService.resendOTP(req.body);
  return apiResponse.success(res, {
    message: result.message,
    data: result,
  });
});

export const login = asyncHandler(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  const result = await authService.loginCustomer({
    email: req.body.email,
    password: req.body.password,
    deviceInfo,
    ipAddress,
  });

  if (result.requiresVerification) {
    return apiResponse.success(res, {
      statusCode: 200,
      message: result.message,
      data: result,
    });
  }

  setRefreshTokenCookie(res, result.refreshToken);

  return apiResponse.success(res, {
    message: 'Welcome back to FORME.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  const result = await authService.loginAdmin({
    email: req.body.email,
    password: req.body.password,
    deviceInfo,
    ipAddress,
  });

  setRefreshTokenCookie(res, result.refreshToken);

  return apiResponse.success(res, {
    message: 'Authenticated to FORME Administrative Command Center.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  const result = await authService.loginWithGoogle({
    credential: req.body.credential,
    deviceInfo,
    ipAddress,
  });

  setRefreshTokenCookie(res, result.refreshToken);

  return apiResponse.success(res, {
    message: 'Authenticated successfully via Google.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const rawToken = req.cookies.refreshToken || req.body.refreshToken;
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;

  const result = await tokenService.rotateRefreshToken(rawToken, deviceInfo, ipAddress);

  setRefreshTokenCookie(res, result.refreshToken);

  return apiResponse.success(res, {
    message: 'Session refreshed successfully.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies.refreshToken || req.body.refreshToken;
  if (rawToken) {
    await tokenService.revokeRefreshToken(rawToken);
  }

  clearRefreshTokenCookie(res);

  return apiResponse.success(res, {
    message: 'Successfully signed out from this session.',
  });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await tokenService.revokeAllUserSessions(req.user.id);
  clearRefreshTokenCookie(res);

  return apiResponse.success(res, {
    message: 'Successfully signed out from all active sessions.',
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  return apiResponse.success(res, {
    message: result.message,
    data: result,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  clearRefreshTokenCookie(res);
  return apiResponse.success(res, {
    message: result.message,
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword({
    userId: req.user.id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  return apiResponse.success(res, {
    message: result.message,
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return apiResponse.success(res, {
    message: 'User profile retrieved.',
    data: { user },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await authService.updateProfile({
    userId: req.user.id,
    name: req.body.name,
    phone: req.body.phone,
    avatarUrl: req.body.avatarUrl,
  });
  return apiResponse.success(res, {
    message: 'Profile updated successfully.',
    data: { user: updatedUser },
  });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const file = req.file || (req.files && (req.files.avatar?.[0] || req.files.file?.[0]));
  if (!file) {
    throw ApplicationError.badRequest('No patron avatar image file provided.');
  }

  const mediaResult = await mediaService.uploadMedia(file, {
    folder: 'forme/avatars',
  });

  const updatedUser = await authService.updateProfile({
    userId: req.user.id,
    avatarUrl: mediaResult.secureUrl,
  });

  return apiResponse.success(res, {
    message: 'Patron portrait uploaded and profile updated successfully.',
    data: {
      user: updatedUser,
      avatarUrl: mediaResult.secureUrl,
      media: mediaResult,
    },
  });
});

export default {
  register,
  verifyOTP,
  resendOTP,
  login,
  adminLogin,
  googleLogin,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
};

