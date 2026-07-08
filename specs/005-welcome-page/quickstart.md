# Quickstart: Welcome Page with MVP1 Onboarding

**Feature**: 005-welcome-page | **Date**: 2026-07-07

## Prerequisites

- Node.js 18+ and npm installed
- Dependencies installed (`npm install` from repo root)
- Both the NestJS API and Angular dev server running

## Start the App

```bash
# From repo root — starts Angular (port 4200) and NestJS (port 3000) in parallel
npx nx run-many --target=serve --all --parallel
```

Open: http://localhost:4200

---

## Validation Scenarios

### Scenario 1: Welcome Page Always Shown (FR-001, FR-002, FR-003)

**Steps**:
1. Navigate to http://localhost:4200/
2. Confirm you land on `/welcome`
3. Verify the page shows a welcome heading, the exact command `claude auth login` displayed prominently, and an explanation mentioning the MVP1 / no API key constraint

**Expected**: Welcome page is always shown on every visit; command is visible without scrolling.

---

### Scenario 2: Terminal Launch Button (FR-004)

**Steps**:
1. On the welcome page, click "Open Terminal"
2. A terminal window opens on your OS (Windows: cmd.exe or Windows Terminal; macOS: Terminal.app; Linux: gnome-terminal or xterm)

**Expected on success**: Terminal window appears.  
**Expected on failure**: The button is disabled and a fallback instruction block appears with OS-specific step-by-step instructions for opening a terminal manually.

---

### Scenario 3: Copy to Clipboard (FR-005, SC-002)

**Steps**:
1. On the welcome page, locate the `claude auth login` command block
2. Click the copy icon or "Copy" button
3. Paste into a text editor — confirm the text is exactly `claude auth login`

**Expected**: Paste produces `claude auth login`. The button label changes to "Copied!" for ~2 seconds, then reverts.

---

### Scenario 4: Start Refinement Navigation (FR-010)

**Steps**:
1. On the welcome page, click "Start Refinement"
2. Confirm redirect to `/input`
3. Use the browser back button to return to `/welcome`
4. Confirm the welcome page is shown again (no skip)

**Expected**: "Start Refinement" navigates to `/input`. Navigating back shows the welcome page again unconditionally.

---

### Scenario 5: MVP1 Roadmap Section (FR-006, FR-007, FR-008, FR-009, SC-004)

**Steps**:
1. On the welcome page, locate the "MVP1 Release" section
2. On the "Current Features" tab, verify at minimum: *AI Backlog Refinement* and *Story Review & Approval*
3. Switch to the "Coming Soon" tab
4. Verify all four planned phases are displayed: *Requirements Refinement*, *Feature Specification*, *Planning*, *Task Generation*

**Expected**: Both tabs show correct content without a page reload. All four future phases are present on the Coming Soon tab. Switching tabs does not trigger a page reload (SC-004 acceptance scenario 4).

---

### Scenario 6: Render Time (SC-005)

**Steps**:
1. Open DevTools → Network — ensure throttling is set to "No throttling"
2. Hard-refresh the welcome page (Ctrl+Shift+R)
3. Check the Load event timing in the Network tab waterfall

**Expected**: Page is fully readable (text visible, layout stable) within 2 seconds of first load.

---

## References

- [Contract: POST /api/terminal/open](contracts/terminal-open.md)
- [Data Model](data-model.md)
- [Research Notes](research.md)
- [Feature Spec](spec.md)
