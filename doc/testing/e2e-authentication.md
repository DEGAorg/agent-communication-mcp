# End-to-End Authentication Script

## Overview

The `e2e-auth` script provides a command-line interface for managing Supabase authentication tokens for end-to-end testing scenarios. It allows test automation to create, store, load, and refresh authentication tokens without manual intervention.

## Purpose

This script addresses the need for automated authentication in end-to-end testing by:

1. **Token Creation**: Automatically authenticates with Supabase using email OTP
2. **Token Storage**: Securely stores authentication tokens in the `.storage/auth/` directory
3. **Token Loading**: Loads and validates stored tokens for reuse
4. **Token Refresh**: Automatically refreshes tokens before they expire
5. **Token Management**: Provides status checking and cleanup capabilities

## Features

- **Secure Storage**: Tokens are stored with restrictive file permissions (600)
- **Automatic Validation**: Validates token expiration and validity
- **Refresh Logic**: Automatically refreshes tokens when they're about to expire
- **Agent-Specific**: Supports multiple agents with separate token storage
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Installation

The script is available as a yarn script in `package.json`:

```bash
yarn e2e:auth [options]
```

## Usage

### Basic Authentication Flow

1. **Send OTP** (first step):
   ```bash
   yarn e2e:auth --email user@example.com
   ```

2. **Verify OTP** (second step):
   ```bash
   yarn e2e:auth --email user@example.com --code 123456
   ```

### Token Management

**Load and validate existing token:**
```bash
yarn e2e:auth --load
```

**Check token status:**
```bash
yarn e2e:auth --status
```

**Refresh token if needed:**
```bash
yarn e2e:auth --refresh
```

**Delete stored token:**
```bash
yarn e2e:auth --delete
```

**Use specific agent ID:**
```bash
yarn e2e:auth --agent-id my-agent --email user@example.com
```

## Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `-e, --email <email>` | Email address for authentication | `--email user@example.com` |
| `-c, --code <code>` | OTP verification code (6 digits) | `--code 123456` |
| `-a, --agent-id <id>` | Agent ID (defaults to AGENT_ID env var) | `--agent-id test-agent` |
| `-l, --load` | Load and validate existing token | `--load` |
| `-s, --status` | Check token status and expiration | `--status` |
| `-r, --refresh` | Refresh token if it expires soon | `--refresh` |
| `-d, --delete` | Delete stored token | `--delete` |

## Token Storage

Tokens are stored in the following location:
```
.storage/auth/{agent-id}/e2e-token.json
```

The token file contains:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_at": 1703123456,
  "user_id": "uuid",
  "email": "user@example.com",
  "created_at": "2023-12-21T10:30:00.000Z"
}
```

## Environment Variables

The script requires the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `AGENT_ID`: Default agent ID (can be overridden with `--agent-id`)

## Integration with Testing

### Automated Test Setup

For automated testing, you can use the script in your test setup:

```typescript
// test/setup.ts
import { execSync } from 'child_process';

beforeAll(async () => {
  // Ensure we have a valid token
  try {
    execSync('yarn e2e:auth --load', { stdio: 'inherit' });
  } catch (error) {
    // If no token exists, create one
    execSync('yarn e2e:auth --email test@example.com --code 123456', { stdio: 'inherit' });
  }
});
```

### CI/CD Integration

For continuous integration, you can pre-authenticate:

```yaml
# .github/workflows/test.yml
- name: Setup authentication
  run: |
    yarn e2e:auth --email ${{ secrets.TEST_EMAIL }} --code ${{ secrets.TEST_OTP }}
```

### Test Helper Functions

You can create helper functions for your tests:

```typescript
// test/helpers/auth.ts
import { execSync } from 'child_process';

export function ensureAuthenticated(): void {
  try {
    execSync('yarn e2e:auth --load', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('Authentication required. Run: yarn e2e:auth --email <email> --code <otp>');
  }
}

export function refreshTokenIfNeeded(): void {
  execSync('yarn e2e:auth --refresh', { stdio: 'pipe' });
}
```

> **Note**: For more complex authentication scenarios, you can create custom helper functions based on the `e2e-auth` script functionality.

## Security Considerations

1. **File Permissions**: Token files are stored with 600 permissions (user read/write only)
2. **Directory Permissions**: Auth directories use 700 permissions
3. **Token Expiration**: Tokens are automatically validated and refreshed
4. **Secure Storage**: Tokens are stored in the `.storage` directory (should be in `.gitignore`)

## Error Handling

The script provides clear error messages for common scenarios:

- **Missing environment variables**: Clear indication of required env vars
- **Invalid OTP**: Specific error messages for OTP verification failures
- **Expired tokens**: Automatic detection and refresh suggestions
- **Network errors**: Connection issues with Supabase

## Troubleshooting

### Common Issues

1. **"No stored token found"**
   - Run the authentication flow: `yarn e2e:auth --email <email>`

2. **"Token is invalid or expired"**
   - Refresh the token: `yarn e2e:auth --refresh`
   - Or re-authenticate: `yarn e2e:auth --email <email> --code <otp>`

3. **"Failed to send OTP"**
   - Check your Supabase configuration
   - Verify email format
   - Check network connectivity

4. **"OTP verification failed"**
   - Ensure the code is exactly 6 digits
   - Check that the code hasn't expired
   - Verify the email matches the one used to send the OTP

### Debug Mode

For debugging, you can add verbose logging by setting the log level:

```bash
LOG_LEVEL=debug yarn e2e:auth --status
```

## Examples

### Complete Authentication Workflow

```bash
# 1. Send OTP
yarn e2e:auth --email test@example.com

# 2. Check email for OTP code (e.g., 123456)

# 3. Verify OTP
yarn e2e:auth --email test@example.com --code 123456

# 4. Verify token is stored
yarn e2e:auth --status

# 5. Use in tests
yarn e2e:auth --load
```

### Automated Testing Script

```bash
#!/bin/bash
# test-auth.sh

# Ensure authentication
if ! yarn e2e:auth --load > /dev/null 2>&1; then
    echo "Authentication required. Please run:"
    echo "yarn e2e:auth --email <email> --code <otp>"
    exit 1
fi

# Refresh if needed
yarn e2e:auth --refresh

# Run tests
yarn test
```

## Related Documentation

- [System Design](system-design.md) - Overall system architecture
- [Authentication Flow](system-design.md#authentication-and-access-flow) - Authentication requirements
- [Project Overview](project-overview.md) - Project context and features
