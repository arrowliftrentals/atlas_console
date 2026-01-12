# WARP Console - UI Test Session

**Test Date**: January 12, 2026  
**Tester**: Manual verification in browser  
**Console URL**: http://localhost:3000  
**Backend URL**: http://localhost:8000  

**Instructions**: 
- Open http://localhost:3000 in your browser
- Go through each section below and mark items as ✅ (pass), ❌ (fail), or ⚠️ (partial)
- Add notes for any issues found

---

## Test Section 1: Architecture Tab

**Access**: Click "Architecture" tab in main console

### 1.1 Node Display
- [✅] **Count nodes**: Should see exactly 19 nodes
  - Notes: _____________
  
- [✅] **Cognitive region colors** (50% opacity):
  - [✅] Gold nodes (Core): coreloop, reasoningservice, agentrouter, llmclient, intentparser (5 total)
  - [✅] Pink nodes (Memory): memorymanager, episodicstore, declarativestore, proceduralstore, roadmapstore, database, vectorstore (7 total)
  - [✅] Cyan nodes (Perception): screencontroller, devicemanager, fileops, sandboxmanager, learningmanager, telemetry, apiserver (7 total)
  - Notes: _____________

- [✅] **Node status borders**:
  - [✅] Live nodes have GREEN border (#22C55E, 4px)
  - [✅] Stubbed nodes have AMBER border (#F59E0B, 4px)
  - Notes: _____________

### 1.2 Layout Algorithms
- [✅] **Hierarchical layout**: Left-to-right flow, nodes organized by tier
  - Notes: _____________
  
- [✅] **Layered layout**: Complex layering visible
  - Notes: _____________
  
- [✅] **Force layout**: Force-directed, nodes properly distributed
  - Notes: _____________

### 1.3 Node Interactions
- [✅ ] **Click node**: Details panel appears on right side
- [ ✅] **Details panel shows**: Name, status (live/stubbed), description, dependencies
- [ ✅] **Click outside**: Details panel closes
  - Notes: __Node navigator button is missing from all three views. Only shows on the visualizer___________

### 1.4 Legend Display
- [ ✅] **Legend shows**:
  - [ ✅] 🟡 Gold square - "Core (Control & Reasoning)"
  - [ ✅] 🟣 Pink square - "Memory (Storage & Learning)"
  - [ ✅] 🔵 Cyan square - "Perception (Tools & Environment)"
  - Notes: _____________

---

## Test Section 2: Analysis Panel

**Access**: In Architecture tab, click "Analysis" button

### 2.1 Panel Visibility
- [ ✅] **Analysis button ON**: Panel appears on right side
- [✅ ] **Analysis button OFF**: Panel disappears
- [ ✅] **Toggle again**: Panel reappears in same position (not shifted)
  - Notes: _____________

### 2.2 Panel Interaction with Other Features
- [✅ ] **Timeline + Analysis**: Both visible (Timeline at bottom, Analysis on right)
- [✅ ] **Matrix + Analysis**: Analysis hides when Matrix is ON (Matrix is fullscreen)
- [ ✅] **Matrix OFF**: Analysis reappears
  - Notes: _____________

### 2.3 Analysis Tabs Content

**Bottlenecks Tab**:
- [✅ ] Shows 4 bottleneck components
- [✅ ] Components color-coded by cognitive region
- [✅ ] llmclient shown in GOLD (core region)
- ✅[ ] coreloop shown in GOLD (core region)
- ✅[ ] memory shown in PINK (memory region)
- [✅ ] intentparser shown in GOLD (core region)
- [✅ ] Avg times displayed (llmclient ~1139ms, coreloop ~886ms)
  - Notes: _____________

**Critical Paths Tab**:
- [ ✅] Shows critical paths with source→target format
- [✅ ] Source and target names color-coded by their regions
- [✅ ] Criticality metrics displayed
  - Notes: __what does the criticality number mean? What is the scale? What is good vs bad?___________

**Hot Paths Tab**:
- [✅ ] Shows most frequently used paths
- [ ✅] Source→target names color-coded by regions
- [✅ ] Usage counts displayed
  - Notes: _____________

**Flows Tab**:
- [ ✅] Shows recent 20 dependency flows
- [ ✅] Component names color-coded by cognitive region
- [ ✅] Flow directions clear
  - Notes: __Intent for all is: UNKNOWN___________

### 2.4 Node Highlighting
- [✅ ] Click component in Bottlenecks tab
- [ ✅] Corresponding node highlights in architecture graph
  - Notes: ____Memory does not highlight a node. All other work_________

---

## Test Section 3: Neural 3D Visualization

**Access**: Click "Neural 3D" tab

### 3.1 3D Scene Rendering
- [ ✅] 3D scene loads without errors
- [✅ ] Three concentric shells visible (Core, Memory, Perception)
- [ ✅] Nodes positioned on shells
- [ ✅] Can rotate scene with mouse drag
- [ ✅] Can zoom with mouse wheel
  - Notes: _____________

### 3.2 Node Selector Panel
- [ ✅] **"Show Nodes" button** visible at bottom-right
- [ ✅] **Click button**: Panel expands upward
- [✅ ] **Panel shows**: List of all nodes grouped by cognitive region
  - Notes: _____________

### 3.3 Node Selector Features

**Search Functionality**:
- [ ✅] Type "core": Shows coreloop, agentrouter
- [ ✅] Type "memory": Shows memorymanager, stores
- [ ✅] Type "llm": Shows llmclient
- [✅ ] Clear search: All nodes reappear
  - Notes: _____________

**Region Grouping**:
- [❌ ] **Core section**: Gold colored nodes
- [❌ ] **Memory section**: Pink colored nodes
- [❌ ] **Perception section**: Cyan colored nodes
- [❌ ] Sections clearly separated/labeled
  - Notes: __Labels are too small to read___________

### 3.4 Camera Focus Animation
- [✅ ] Click any node in selector list
- [ ✅] Camera smoothly animates to selected node (500ms duration)
- [ ✅] Selected node centered in view
- [✅] Zoom level appropriate (close enough to see details)
- [ ✅] Rotation still works around center [0,0,0]
- [ ✅] Select different node: Camera smoothly transitions
  - Notes: _____________

---

## Test Section 4: Chat Panel

**Access**: Chat panel is always visible on right side

### 4.1 Basic Chat Functionality
- [ ✅] Chat input field visible at bottom
- [ ✅] Send test query: "Hello, are you there?"
- [ ✅] Response appears within 2-3 seconds
- [ ✅] Response is coherent LLM output (not error)
  - Notes: _____________

### 4.2 Conversation History
- [✅ ] Previous messages remain visible after sending new message
- [ ✅] User messages clearly distinguished from assistant messages
- [ ✅] Messages properly formatted
  - Notes: _____________

### 4.3 Complex Query
- [ ✅] Send query requiring reasoning: "What is 15 * 23 + 47?"
- [❌ ] Response shows correct answer (392)
- [✅ ] Response time reasonable (<5 seconds)
  - Notes: __gave answer of 362___________

### 4.4 Streaming Updates (if enabled)
- [ ] Long response appears incrementally (streaming)
- [ ] OR response appears all at once (non-streaming)
- [ ] No visual glitches during response
  - Notes: __Unsure what this means or how to test___________

---

## Test Section 5: Skills Tab

**Access**: Click "Skills" tab

### 5.1 Skills Display
- [✅ ] Tab loads without errors
- [✅ ] Shows skill execution records
- [ ✅] Approximately 50 executions visible (may require scrolling)
  - Notes: _Created: "Invalid Date" for all. Skill Specification shows nothing, box doesn't open enough. Same for execution result.___________

### 5.2 Data Quality Check
- [✅ ] **Check timestamps**: All dates are January 11 or earlier (EXPECTED - known issue)
- [✅ ] Timestamp format readable
- [ ✅] Skill names/commands displayed
  - Notes: __All dates from 1/12/26___________

**⚠️ KNOWN ISSUE**: Skills data is stale (Jan 11). This is expected behavior until backend bug is fixed. Mark this test as PASS if data displays correctly, even though it's not real-time.

---

## Test Section 6: Other Tabs

### 6.1 Code Tab
- [✅ ] Click "Code" tab
- [ ✅] File explorer shows workspace files
- [✅ ] Can navigate directories
- [ ✅] Can select file to view
  - Notes: ___slow to load. Lag after clicking.__________

### 6.2 Matrix View
- [✅ ] In Architecture tab, click "Matrix" button
- [✅ ] Dependency matrix displays
- [ ✅] Matrix is fullscreen (Analysis panel hidden)
- [✅ ] Can read node dependencies
- [✅ ] Click Matrix OFF: Returns to normal view
  - Notes: __all colors are green. Previously red and orange.___________

### 6.3 Timeline
- [ ✅] In Architecture tab, click "Timeline" button
- [ ✅] Timeline panel appears at bottom
- [❌ ] Timeline shows historical data
- [✅ ] Timeline OFF: Panel disappears
  - Notes: shows 1/0 for timeline. No actual history_____________

### 6.4 Sandbox Tab (if visible)
- [✅ ] Click "Sandbox" tab
- [✅ ] Interface for command execution visible
- [❌ ] (Optional) Test safe command like "echo test"
  - Notes: ___Error: ssh: connect to host localhost port 2222: Connection refused__________

### 6.5 Logs Tab
- [✅] Click "Logs" tab (or Activity/Telemetry if differently named)
- [❌ ] Activity logs display
- [❌ ] Recent events visible
- [ ❌] Logs update with new activity
  - Notes: _____________

---

## Test Section 7: Error Edge Visualization

**Note**: This requires generating an error condition

### 7.1 Generate Test Error
Try one of these methods:
- Ask Atlas to execute invalid command: "run the command 'thisdoesnotexist123'" RESPONSE: What would you like me to do with 'thisdoesnotexist123'?

- Send malformed query
- Disconnect backend briefly

### 7.2 Error Edge Display
- [ ] Wait 5 seconds after error occurs
- [ ] Return to Architecture tab
- [ ] Red edge appears between relevant nodes (3px width, red color #EF4444)
- [ ] Edge connects correct source→target nodes
- [ ] (Later) Error edge disappears when error resolves
  - Notes: _____________

**If no error edge appears**: This is OK to defer testing until backend bug fix allows reliable error generation.

---

## Test Section 8: Performance & Stability

### 8.1 Tab Switching
- [ ✅] Switch rapidly between tabs (Code → Architecture → Neural 3D → Skills)
- [ ✅] No lag or stuttering
- [ ✅] Each tab loads instantly
- [✅ ] No console errors in browser dev tools
  - Notes: _____________

### 8.2 3D Performance
- [✅ ] Neural 3D tab maintains 60fps during rotation
- [✅ ] No stuttering when selecting nodes
- [ ✅] Particle animations smooth (if particles visible)
  - Notes: _____________

### 8.3 Browser Console Errors
- [ ] Open browser dev tools (F12 or Cmd+Opt+I)
- [ ] Check Console tab for errors
- [ ] **Report**: Any red errors present? (List them)
  - Notes: _____________

---

## Test Results Summary

### Pass/Fail Counts
- Architecture Tab: ___/15 passed
- Analysis Panel: ___/12 passed
- Neural 3D: ___/10 passed
- Chat Panel: ___/6 passed
- Skills Tab: ___/3 passed (expect stale data)
- Other Tabs: ___/8 passed
- Error Edges: ___/4 passed (optional)
- Performance: ___/5 passed

**Total**: ___/63 tests passed

### Critical Issues Found
(List any blocking issues here)

### Minor Issues Found
(List any cosmetic or non-blocking issues here)

### Browser & Environment
- **Browser**: _______________
- **OS**: macOS
- **Screen Resolution**: _______________
- **Any Extensions**: _______________

---

## Next Steps After Testing

Based on test results:
1. ✅ **All tests pass**: Proceed to fix Skills Integration bug, then commit Phase 2
2. ⚠️ **Some tests fail**: Document failures, fix issues, retest
3. ❌ **Major failures**: Investigate root cause, fix critical bugs first

**Tester Notes**:
(Add any additional observations or concerns here)

---

**End of Test Session**
