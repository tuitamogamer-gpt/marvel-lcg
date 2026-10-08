/** Shared Hyperframes timeline. Remotion seeks it using its frame clock. */
export function milestoneTimeline(gsap, root) {
  const q = s => root.querySelector(s);
  return gsap.timeline({paused:true})
    .fromTo(q(".milestone-panel"), {opacity:0, y:24, scale:.96}, {opacity:1,y:0,scale:1,duration:.24,ease:"power3.out"},0)
    .fromTo(q(".milestone-title"), {opacity:0,x:-18}, {opacity:1,x:0,duration:.22,ease:"power2.out"},.08)
    .fromTo(q(".milestone-detail"), {opacity:0,y:8}, {opacity:1,y:0,duration:.2,ease:"sine.out"},.18)
    .to(q(".milestone-panel"), {opacity:0,y:-12,duration:.22,ease:"power2.in"},1.38);
}
