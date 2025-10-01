## Changelog

### 1.3.0

- Removed AdminApi multi-key storage capabilities
- Removed unnecessary "user-verified" scope post and delete calls, use `withCredentials` instead

### 1.2.0
- Added multi-request possibility
- Added token caching per scope
- Fixed errors to be returned instead of thrown

### 1.1.0

- Added support for user-verified token generation
- Adjusted banner closing logic
- Adjusted waiting logic after admin login

### 1.0.0
- Initial release
- Admin API client with authentication
- Storefront API client with context management
- Database fixtures for direct DB access
- Admin login automation
- Utility functions for common tasks
- TypeScript definitions
- Comprehensive test fixtures
