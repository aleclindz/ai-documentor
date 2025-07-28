const express = require('express');
const { body, validationResult } = require('express-validator');
const { getUsersFromDB, createUserInDB, deleteUserFromDB } = require('../database/userService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/users
 * Retrieves all users from the database
 * Requires authentication
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const users = await getUsersFromDB({
      offset: parseInt(offset),
      limit: parseInt(limit),
      search: search || ''
    });

    const totalCount = await getUsersFromDB({ count: true, search });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/users/:id
 * Retrieves a specific user by ID
 * Requires authentication
 */
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      });
    }

    const user = await getUsersFromDB({ id: parseInt(id) });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: `User with ID ${id} does not exist`
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch user'
    });
  }
});

/**
 * POST /api/users
 * Creates a new user
 * Requires authentication and validation
 */
router.post('/users', 
  authenticateToken,
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Must be a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { name, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await getUsersFromDB({ email });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'A user with this email already exists'
        });
      }

      const newUser = await createUserInDB({
        name,
        email,
        password
      });

      // Remove password from response
      const { password: _, ...userResponse } = newUser;
      
      res.status(201).json({
        message: 'User created successfully',
        user: userResponse
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to create user'
      });
    }
  }
);

/**
 * PUT /api/users/:id
 * Updates an existing user
 * Requires authentication and validation
 */
router.put('/users/:id',
  authenticateToken,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Must be a valid email address')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const updates = req.body;

      const updatedUser = await updateUserInDB(parseInt(id), updates);
      
      if (!updatedUser) {
        return res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`
        });
      }

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to update user'
      });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Deletes a user by ID
 * Requires authentication
 */
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      });
    }

    const deleted = await deleteUserFromDB(parseInt(id));
    
    if (!deleted) {
      return res.status(404).json({ 
        error: 'User not found',
        message: `User with ID ${id} does not exist`
      });
    }

    res.json({
      message: 'User deleted successfully',
      deletedId: parseInt(id)
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete user'
    });
  }
});

module.exports = router;