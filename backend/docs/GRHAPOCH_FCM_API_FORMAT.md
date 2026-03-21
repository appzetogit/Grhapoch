# GrhaPoch FCM API Format

Base URL: `https://api.grhapoch.com/api`

---

## 1) Login APIs

### For User

**Endpoint:** `POST /auth/login`  
**Full URL:** `https://api.grhapoch.com/api/auth/login`

```json
{
  "email": "customer@gmail.com",
  "password": "password123",
  "role": "user"
}
```

### For Restaurant (Seller)

**Endpoint:** `POST /restaurant/auth/login`  
**Full URL:** `https://api.grhapoch.com/api/restaurant/auth/login`

```json
{
  "email": "restaurant@gmail.com",
  "password": "password123"
}
```

### For Delivery

Delivery login OTP-based hai.

**Step 1 (Send OTP)**  
**Endpoint:** `POST /delivery/auth/send-otp`  
**Full URL:** `https://api.grhapoch.com/api/delivery/auth/send-otp`

```json
{
  "phone": "9876543210",
  "purpose": "login"
}
```

**Step 2 (Verify OTP / Login)**  
**Endpoint:** `POST /delivery/auth/verify-otp`  
**Full URL:** `https://api.grhapoch.com/api/delivery/auth/verify-otp`

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "purpose": "login"
}
```

---

## 2) FCM Token Save APIs

> In tino APIs ke liye access token required hai.

### For User FCM Token

**Endpoint:** `POST /auth/fcm-token`  
**Full URL:** `https://api.grhapoch.com/api/auth/fcm-token`

```json
{
  "token": "fcm_token_value_here",
  "platform": "app"
}
```

### For Restaurant (Seller) FCM Token

**Endpoint:** `POST /restaurant/auth/fcm-token`  
**Full URL:** `https://api.grhapoch.com/api/restaurant/auth/fcm-token`

```json
{
  "token": "fcm_token_value_here",
  "platform": "app"
}
```

### For Delivery FCM Token

**Endpoint:** `POST /delivery/auth/fcm-token`  
**Full URL:** `https://api.grhapoch.com/api/delivery/auth/fcm-token`

```json
{
  "token": "fcm_token_value_here",
  "platform": "app"
}
```

---

## 3) Required Headers (FCM APIs)

- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

---

## 4) Platform to Database Field Mapping

Database schema fields:

- `fcmTokenWeb`
- `fcmTokenAndroid`
- `fcmTokenIos`

Platform mapping:

- `platform: "web"` -> `fcmTokenWeb`
- `platform: "android"` -> `fcmTokenAndroid`
- `platform: "ios"` -> `fcmTokenIos`
- `platform: "app"` -> default app mapping (Android default; iOS ke liye `"ios"` bhejna recommended)

---

## 5) Notes for Flutter Team

- User and Restaurant login email/password se hota hai.
- Delivery login OTP se hota hai.
- Login response ka `accessToken` use karke FCM token API call karo.
- Same user/device ke liye latest token save hoga.
- Recommended:
  - Android app: `platform: "android"`
  - iOS app: `platform: "ios"`
  - Web app: `platform: "web"`

