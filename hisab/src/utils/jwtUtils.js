import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

export const generateToken = (user) => {
    const payload = { 
        id: user.id, 
        email: user.email, 
        roleId: user.role_id 
    };
    
    // Add type field if it exists (for portal contacts)
    if (user.type) {
        payload.type = user.type;
    }
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};