# Particle Animation Testing

**Date**: January 12, 2026  
**Feature**: Curved Bezier Path Particle Animations  
**Status**: Ready for Testing  

---

## Prerequisites

✅ Backend running: http://localhost:8000 (healthy)  
✅ Frontend running: http://localhost:3000 (responding)  

---

## Test Plan

### Test 1: Visual Inspection - Curved Paths

**Objective**: Verify particles follow curved paths instead of straight lines

**Steps**:
1. Open http://localhost:3000
2. Navigate to **Neural 3D** tab
3. Wait for 3D scene to load
4. Observe particle movements

**Expected Results**:
- [ ] Particles follow curved, arcing paths between nodes
- [ ] Curves are smooth and continuous (not jagged)
- [ ] Path curvature is visible but not excessive
- [ ] Particles don't jump or teleport

**How to Spot Curved Paths**:
- Watch for particles that arc outward from the straight line between nodes
- Particles should flow in graceful curves, not rigid straight lines
- Compare to old straight-line animation (mental comparison)

---

### Test 2: Performance - 60fps Maintained

**Objective**: Ensure animations don't cause frame drops

**Steps**:
1. Open browser DevTools (F12 or Cmd+Opt+I)
2. Go to **Performance** or **Rendering** tab
3. Enable "FPS meter" or "Frame Rendering Stats"
4. Navigate to Neural 3D tab
5. Watch particles animate for 30 seconds

**Expected Results**:
- [ ] FPS stays at 60 (or close to monitor refresh rate)
- [ ] No stuttering or lag
- [ ] Smooth rotation and zoom
- [ ] Particles move fluidly

**Performance Benchmarks**:
- 0-50 particles: Should maintain 60fps easily
- 50-200 particles: Should maintain 55-60fps
- 200+ particles: May drop to 45-55fps (acceptable)

---

### Test 3: Particle Spawning

**Objective**: Verify particles spawn when system is active

**Steps**:
1. Open Neural 3D tab
2. In another tab/window, interact with Atlas (send a chat message)
3. Watch the 3D visualization for new particles

**Expected Results**:
- [ ] New particles appear when Atlas processes requests
- [ ] Particles spawn from source nodes
- [ ] Particles travel toward target nodes
- [ ] Particles disappear after reaching target

**Chat Test Queries**:
- "What is 2+2?"
- "List files in the current directory"
- "What day is it?"

---

### Test 4: Color Coding

**Objective**: Verify particles inherit correct colors from source nodes

**Steps**:
1. Identify node colors in the visualization:
   - **Gold** = Core nodes (coreloop, reasoningservice, agentrouter)
   - **Pink** = Memory nodes (memorymanager, stores)
   - **Cyan** = Perception nodes (fileops, telemetry)
2. Watch particles spawning from different colored nodes
3. Note particle colors

**Expected Results**:
- [ ] Particles from gold nodes are gold
- [ ] Particles from pink nodes are pink
- [ ] Particles from cyan nodes are cyan
- [ ] Colors are vibrant and visible

---

### Test 5: Multiple Simultaneous Particles

**Objective**: Test system with high particle count

**Steps**:
1. Generate multiple Atlas requests quickly:
   - Send several chat messages rapidly
   - Or trigger multiple operations
2. Watch for many particles simultaneously
3. Count approximate number of visible particles

**Expected Results**:
- [ ] Multiple particles can exist at once
- [ ] Particles don't collide or overlap (reflection effect)
- [ ] Each particle maintains its own trajectory
- [ ] Performance remains acceptable

**Stress Test**:
- Try to get 50+ particles visible
- Check if FPS drops significantly
- Verify no memory leaks over time

---

### Test 6: Edge Cases

**Objective**: Test unusual scenarios

**Test 6a: Same-Node Edges**
- If a node sends to itself, particle should handle gracefully
- May see tiny loops or immediate completion

**Test 6b: Very Close Nodes**
- Particles between adjacent nodes should curve subtly
- Short paths should still be smooth

**Test 6c: Very Far Nodes**
- Long-distance particles should have pronounced curves
- Should not take excessively long to traverse

**Expected Results**:
- [ ] No crashes or errors
- [ ] All edge cases handled gracefully
- [ ] No NaN or infinite position warnings in console

---

### Test 7: Browser Console Check

**Objective**: Verify no errors in console

**Steps**:
1. Open browser DevTools console
2. Navigate to Neural 3D tab
3. Let particles animate for 2 minutes
4. Review console for errors/warnings

**Expected Results**:
- [ ] No red error messages
- [ ] No "NaN" or "Infinity" warnings
- [ ] Particle activation logs appear (in development)
- [ ] No memory leak warnings

**Acceptable Console Messages**:
- `[PARTICLE ACTIVATED]` - Normal, indicates spawning
- `[PARTICLE COUNT]` - Normal, tracking active particles
- `[STORE]` - Normal, telemetry events

**Problematic Messages**:
- "Invalid position computed"
- "NaN" or "Infinity" in coordinates
- "Memory leak detected"
- React errors or warnings

---

### Test 8: Camera Interaction

**Objective**: Ensure particles work with camera movement

**Steps**:
1. Open Neural 3D tab
2. Wait for particles to appear
3. Rotate camera (drag with mouse)
4. Zoom in and out (mouse wheel)
5. Observe particles during camera movement

**Expected Results**:
- [ ] Particles remain visible during rotation
- [ ] No z-fighting or rendering glitches
- [ ] Particles maintain proper depth
- [ ] Smooth transitions during zoom

---

### Test 9: Tab Switching

**Objective**: Verify particles pause/resume correctly

**Steps**:
1. Open Neural 3D tab with active particles
2. Switch to Architecture tab
3. Wait 5 seconds
4. Switch back to Neural 3D tab

**Expected Results**:
- [ ] Particles resume animating
- [ ] No frozen particles
- [ ] No excessive particle accumulation
- [ ] Performance remains good

---

### Test 10: Long-Running Stability

**Objective**: Check for memory leaks over time

**Steps**:
1. Open Neural 3D tab
2. Let it run for 10 minutes
3. Monitor browser memory usage (DevTools > Memory)
4. Generate periodic activity (send chat messages every minute)

**Expected Results**:
- [ ] Memory usage stabilizes (not constantly growing)
- [ ] Particle count doesn't grow unbounded
- [ ] FPS remains consistent
- [ ] No browser slowdown

**Memory Benchmarks**:
- Initial: ~150-200 MB
- After 10 min: ~200-300 MB (acceptable)
- If > 500 MB: Potential leak

---

## Known Issues (From Phase 2)

These are NOT related to particle animations but may be visible:

1. **Timeline shows 1/0** - Backend endpoint missing
2. **Logs Tab empty** - Backend not tracking logs  
3. **Skills data stale** - Backend not updating

These won't affect particle animation testing.

---

## Success Criteria

**PASS** if:
- ✅ Particles follow visible curved paths (not straight lines)
- ✅ 60fps maintained with <100 particles
- ✅ Particles correctly colored by source node
- ✅ No console errors related to particles
- ✅ Memory usage stable over 10 minutes

**FAIL** if:
- ❌ Particles still follow straight lines (bezier not applied)
- ❌ FPS drops below 30 with <50 particles
- ❌ Frequent "NaN" or "Invalid position" errors
- ❌ Browser crashes or freezes
- ❌ Memory leak (>500MB after 10 minutes)

---

## Test Results

### Visual Inspection
- Curved paths visible: ___
- Smooth animation: ___
- Notes: ___

### Performance
- Average FPS: ___
- Max particles observed: ___
- Notes: ___

### Color Coding
- Gold particles: ___
- Pink particles: ___
- Cyan particles: ___
- Notes: ___

### Console Errors
- Error count: ___
- Warnings: ___
- Critical issues: ___

### Long-Running Stability
- Initial memory: ___ MB
- After 10 min: ___ MB
- FPS after 10 min: ___
- Notes: ___

---

## Troubleshooting

### Problem: No particles visible
**Solution**: 
- Check WebSocket connection (should see telemetry events)
- Send chat messages to Atlas to generate activity
- Check console for particle activation logs

### Problem: Particles still straight
**Solution**:
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- Check if `curvePath` is being created (console logs)
- Verify NeuralPathUtils.ts is loaded

### Problem: Low FPS
**Solution**:
- Check particle count (should be logged)
- Close other browser tabs
- Disable browser extensions
- Check if GPU acceleration is enabled

### Problem: Particles frozen
**Solution**:
- Check if `timeScale` is > 0
- Verify WebSocket is connected
- Refresh the page

---

## Next Steps After Testing

If **PASS**:
- Document results
- Create GIF/video of working animations
- Mark Feature 1 as complete
- Move to Phase 3 Feature 2

If **FAIL**:
- Document specific failures
- Debug issues
- Create fixes
- Retest

---

**Tester**: _______________  
**Test Date**: January 12, 2026  
**Test Duration**: _______________  
**Overall Result**: _______________ (PASS/FAIL)
