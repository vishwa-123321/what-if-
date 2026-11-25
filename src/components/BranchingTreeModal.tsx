import { GitBranch, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FullStoryState, StoryScene } from '../types/story.ts';

interface BranchingTreeModalProps {
  state: FullStoryState;
  onClose: () => void;
  onJumpToScene: (sceneId: string) => void;
}

interface TreeNodeLayout {
  scene: StoryScene;
  x: number;
  y: number;
  isOnActivePath: boolean;
  isCurrent: boolean;
  incomingDecision: string | null;
}

export function BranchingTreeModal({
  state,
  onClose,
  onJumpToScene,
}: BranchingTreeModalProps) {
  const [selectedId, setSelectedId] = useState<string>(state.progress.current_scene_id);
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(() => {
    const scenes = state.scenes;
    const byId = new Map(scenes.map((s) => [s.id, s]));
    const childrenMap = new Map<string | null, StoryScene[]>();

    for (const s of scenes) {
      const parentKey = s.parent_scene_id && byId.has(s.parent_scene_id) ? s.parent_scene_id : null;
      const list = childrenMap.get(parentKey) || [];
      list.push(s);
      childrenMap.set(parentKey, list);
    }

    // Active path from current_scene_id back to root
    const activeSet = new Set<string>();
    let cur = byId.get(state.progress.current_scene_id);
    while (cur && !activeSet.has(cur.id)) {
      activeSet.add(cur.id);
      cur = cur.parent_scene_id ? byId.get(cur.parent_scene_id) : undefined;
    }

    // Decision text leading to each scene
    const decisionByNext = new Map(
      state.decisions
        .filter((d) => d.next_scene_id)
        .map((d) => [d.next_scene_id!, d.decision_text])
    );

    const nodes: TreeNodeLayout[] = [];
    const edges: Array<{ from: TreeNodeLayout; to: TreeNodeLayout; active: boolean }> = [];

    const COL_GAP = 250;
    const ROW_GAP = 128;
    let nextRow = 0;

    function traverse(scene: StoryScene, depth: number): TreeNodeLayout {
      const kids = childrenMap.get(scene.id) || [];
      let y = 0;
      const kidLayouts: TreeNodeLayout[] = [];

      if (kids.length === 0) {
        y = nextRow * ROW_GAP + 70;
        nextRow += 1;
      } else {
        for (const kid of kids) {
          kidLayouts.push(traverse(kid, depth + 1));
        }
        y =
          (kidLayouts[0].y + kidLayouts[kidLayouts.length - 1].y) / 2;
      }

      const node: TreeNodeLayout = {
        scene,
        x: depth * COL_GAP + 40,
        y,
        isOnActivePath: activeSet.has(scene.id),
        isCurrent: scene.id === state.progress.current_scene_id,
        incomingDecision: decisionByNext.get(scene.id) || null,
      };
      nodes.push(node);

      for (const kl of kidLayouts) {
        edges.push({
          from: node,
          to: kl,
          active: node.isOnActivePath && kl.isOnActivePath,
        });
      }

      return node;
    }

    const roots = childrenMap.get(null) || [];
    for (const root of roots) {
      traverse(root, 0);
    }

    const maxX = Math.max(700, ...nodes.map((n) => n.x + 240));
    const maxY = Math.max(360, ...nodes.map((n) => n.y + 110));

    return { nodes, edges, width: maxX, height: maxY };
  }, [state]);

  const selectedNode =
    layout.nodes.find((n) => n.scene.id === selectedId) ||
    layout.nodes[layout.nodes.length - 1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Story Branching Map"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md"
    >
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0C0E16]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#A3AABB] font-mono tabular-nums">
              <GitBranch className="h-3.5 w-3.5 text-[#E5A93C]" />
              <span>{state.branches.length} Branch{state.branches.length === 1 ? '' : 'es'}</span>
              <span aria-hidden="true">·</span>
              <span>{state.scenes.length} Scene{state.scenes.length === 1 ? '' : 's'} Explored</span>
            </div>
            <h2 className="mt-0.5 truncate font-editorial text-xl font-semibold text-[#F5F6FA]">
              Timeline &amp; Turning Points — {state.story.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 text-[#D5DAE6] hover:border-[#E5A93C]/50 cursor-pointer"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 text-[#D5DAE6] hover:border-[#E5A93C]/50 cursor-pointer"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close branching map"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 text-[#D5DAE6] hover:border-white/30 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Split: Canvas + Selected Node Inspector */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
          {/* Interactive Graph Canvas */}
          <div className="relative overflow-auto bg-[#090B12] p-6 lg:col-span-8">
            <div
              style={{
                width: `${layout.width * zoom}px`,
                height: `${layout.height * zoom}px`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: `${layout.width}px`,
                  height: `${layout.height}px`,
                  position: 'relative',
                }}
              >
                <svg
                  width={layout.width}
                  height={layout.height}
                  className="pointer-events-none absolute inset-0"
                >
                  {layout.edges.map((edge) => {
                    const x1 = edge.from.x + 190;
                    const y1 = edge.from.y + 34;
                    const x2 = edge.to.x;
                    const y2 = edge.to.y + 34;
                    const midX = (x1 + x2) / 2;
                    return (
                      <path
                        key={`${edge.from.scene.id}-${edge.to.scene.id}`}
                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={edge.active ? '#E5A93C' : 'rgba(155, 162, 180, 0.3)'}
                        strokeWidth={edge.active ? 2.5 : 1.5}
                      />
                    );
                  })}
                </svg>

                {layout.nodes.map((node) => {
                  const isSelected = node.scene.id === selectedNode?.scene.id;
                  return (
                    <button
                      key={node.scene.id}
                      type="button"
                      onClick={() => setSelectedId(node.scene.id)}
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                        width: '190px',
                      }}
                      className={`absolute rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#E5A93C] bg-[#1A1F2E]'
                          : node.isOnActivePath
                            ? 'border-[#E5A93C]/45 bg-[#131723] hover:border-[#E5A93C]'
                            : 'border-white/10 bg-[#10131D] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#9BA2B4]">
                        <span>
                          Ch {node.scene.chapter_number} · Sc {node.scene.scene_number}
                        </span>
                        {node.isCurrent && (
                          <span className="text-[#E5A93C]">Current</span>
                        )}
                        {node.scene.is_ending && (
                          <span className="text-emerald-400">Ending</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-[#F5F6FA]">
                        {node.scene.scene_title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#8E96AA]">
                        {node.scene.current_location}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Inspector Panel */}
          <div className="flex flex-col justify-between border-t border-white/[0.08] bg-[#0F121C] p-5 lg:col-span-4 lg:border-l lg:border-t-0 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-xs tabular-nums text-[#E5A93C]">
                    Chapter {selectedNode.scene.chapter_number} · Scene{' '}
                    {selectedNode.scene.scene_number}
                  </p>
                  <h3 className="mt-1 font-editorial text-xl font-semibold text-[#F5F6FA]">
                    {selectedNode.scene.scene_title}
                  </h3>
                  <p className="mt-1 text-xs text-[#9BA2B4]">
                    {selectedNode.scene.current_location}
                  </p>
                </div>

                {selectedNode.incomingDecision && (
                  <div className="border-t border-white/[0.08] pt-3">
                    <p className="text-xs font-medium text-[#8E96AA]">
                      Decision That Led Here
                    </p>
                    <p className="mt-1 text-sm text-[#ECEEF4]">
                      “{selectedNode.incomingDecision}”
                    </p>
                  </div>
                )}

                <div className="border-t border-white/[0.08] pt-3">
                  <p className="text-xs font-medium text-[#8E96AA]">
                    What Happened
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#CBD0DD]">
                    {selectedNode.scene.situation_summary.what_happened}
                  </p>
                </div>

                {selectedNode.scene.consequences.length > 0 && (
                  <div className="border-t border-white/[0.08] pt-3">
                    <p className="text-xs font-medium text-[#8E96AA]">
                      Consequences
                    </p>
                    <ul className="mt-1.5 space-y-1.5 text-xs text-[#D6DBE8]">
                      {selectedNode.scene.consequences.map((c, idx) => (
                        <li key={idx} className="leading-relaxed">
                          — {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {selectedNode && (
              <div className="mt-6 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onJumpToScene(selectedNode.scene.id);
                    onClose();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-4 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>
                    {selectedNode.isCurrent
                      ? 'Return to Current Scene'
                      : 'Rewind & Branch From This Scene'}
                  </span>
                </button>
                {!selectedNode.isCurrent && (
                  <p className="mt-2 text-center text-xs text-[#8E96AA]">
                    Your previous timeline remains preserved—choosing a new action here creates an alternate branch.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
