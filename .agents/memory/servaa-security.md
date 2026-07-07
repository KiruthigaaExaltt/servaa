---
name: Servaa security model
description: PIN-based role access control and brute-force lockout
---

**RoleContext** enforces:
- Admin PIN required to assume Admin/Manager roles
- 3 failed PIN attempts triggers a 30-second lockout (tracked in `lockoutUntil` state)
- `requestRoleChange(role, pin)` returns `{ ok, error }` — never throws

**SettingsContext** PIN API:
- `changePin(currentPin: string, newPin: string): boolean` — validates current before accepting new
- No `setAdminPin` is exported; all PIN changes go through `changePin`

**SecurityTab in SettingsHub:**
- 3-field form: Current PIN / New PIN / Confirm PIN
- Validation: min 4 digits, confirm match, current PIN auth
- Error messages shown inline (no toast)

**Why:** Direct `setAdminPin` was a security hole — anyone who could render Settings could change the PIN without knowing the current one.
