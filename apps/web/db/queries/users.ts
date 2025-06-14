import pg from 'pg';
import { User } from '../schema';

/**
 * Get database connection
 */
function getDatabase() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

/**
 * Find a user by their WorkOS user ID
 */
export async function findUserByWorkosId(workosUserId: string): Promise<User | null> {
  const pool = getDatabase();
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE workos_user_id = $1 LIMIT 1',
      [workosUserId]
    );
    
    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

/**
 * Find a user by their primary ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const pool = getDatabase();
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    
    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

/**
 * Create a new user in the database
 */
export async function createUser(userData: {
  id: string;
  workosUserId: string;
  organizationId?: string | null;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}): Promise<User> {
  const pool = getDatabase();
  
  try {
    const result = await pool.query(
      `INSERT INTO users (
        id, workos_user_id, organization_id, email, name, 
        first_name, last_name, profile_picture_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
      RETURNING *`,
      [
        userData.id,
        userData.workosUserId,
        userData.organizationId,
        userData.email,
        userData.name,
        userData.firstName,
        userData.lastName,
        userData.profilePictureUrl,
      ]
    );
    
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

/**
 * Update an existing user in the database
 */
export async function updateUser(workosUserId: string, userData: {
  organizationId?: string | null;
  email?: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}): Promise<User> {
  const pool = getDatabase();
  
  try {
    const result = await pool.query(
      `UPDATE users SET 
        organization_id = COALESCE($2, organization_id),
        email = COALESCE($3, email),
        name = COALESCE($4, name),
        first_name = COALESCE($5, first_name),
        last_name = COALESCE($6, last_name),
        profile_picture_url = COALESCE($7, profile_picture_url),
        updated_at = NOW()
      WHERE workos_user_id = $1
      RETURNING *`,
      [
        workosUserId,
        userData.organizationId,
        userData.email,
        userData.name,
        userData.firstName,
        userData.lastName,
        userData.profilePictureUrl,
      ]
    );
    
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

/**
 * Sync user data from WorkOS - create if not exists, update if exists
 * This is the main function to call when a user signs in
 */
export async function syncUser(workosUser: {
  id: string;
  organizationId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}): Promise<User> {
  try {
    // Check if user already exists
    const existingUser = await findUserByWorkosId(workosUser.id);
    
    const userData = {
      id: workosUser.id, // Use WorkOS ID as primary key
      workosUserId: workosUser.id,
      organizationId: workosUser.organizationId || null,
      email: workosUser.email,
      name: workosUser.firstName && workosUser.lastName 
        ? `${workosUser.firstName} ${workosUser.lastName}` 
        : workosUser.firstName || workosUser.lastName || null,
      firstName: workosUser.firstName || null,
      lastName: workosUser.lastName || null,
      profilePictureUrl: workosUser.profilePictureUrl || null,
    };
    
    if (existingUser) {
      // Update existing user
      return await updateUser(workosUser.id, userData);
    } else {
      // Create new user
      return await createUser(userData);
    }
  } catch (error) {
    console.error('Error syncing user:', error);
    throw error;
  }
}

/**
 * Delete a user (soft delete by setting email to archived state)
 * You might want to implement proper soft deletes in the future
 */
export async function deleteUser(workosUserId: string): Promise<User> {
  const pool = getDatabase();
  
  try {
    const result = await pool.query(
      `UPDATE users SET 
        email = $2,
        updated_at = NOW()
      WHERE workos_user_id = $1
      RETURNING *`,
      [workosUserId, `archived_${Date.now()}_${Math.random()}@deleted.local`]
    );
    
    return result.rows[0];
  } finally {
    await pool.end();
  }
}
