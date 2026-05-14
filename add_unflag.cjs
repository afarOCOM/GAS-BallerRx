const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add FlagOff to import
code = code.replace(/Flag,/g, 'Flag,\n  FlagOff,');

// 2. Add unflaggedItems state
const stateLine = 'const [selectedFlaggedTopic, setSelectedFlaggedTopic] = useState<';
const stateCode = `
  const [unflaggedItems, setUnflaggedItems] = useState<{
    unflaggedAt: number;
    question: Question;
    sessionId: string;
    topic: string;
  }[]>([]);
`;
code = code.replace(stateLine, stateCode + '\n  ' + stateLine);

// 3. Add to initialization block
const initBlock = `
    const savedLessons = localStorage.getItem("omni_board_lessons");
    if (savedLessons) {
      try {
        setLessons(JSON.parse(savedLessons));
      } catch (e) {
        console.error("Failed to parse lessons", e);
      }
    }
`;
const unflagInitCode = `
    const savedUnflag = localStorage.getItem("omni_board_unflagged");
    if (savedUnflag) {
      try {
        const parsed = JSON.parse(savedUnflag);
        const valid = parsed.filter((item) => item.unflaggedAt > Date.now() - 7 * 24 * 60 * 60 * 1000);
        setUnflaggedItems(valid);
        if (valid.length !== parsed.length) localStorage.setItem("omni_board_unflagged", JSON.stringify(valid));
      } catch (e) {
        console.error("Failed to parse unflagged", e);
      }
    }
`;
code = code.replace(initBlock, initBlock + unflagInitCode);

// 4. Add persistance effect
const useEffectBlock = `
  // Continuously sync activeSession
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem("omni_board_active", JSON.stringify(activeSession));
    } else {
      localStorage.removeItem("omni_board_active");
    }
  }, [activeSession]);
`;
const unflagEffectCode = `
  // Sync unflaggedItems
  useEffect(() => {
    localStorage.setItem("omni_board_unflagged", JSON.stringify(unflaggedItems));
  }, [unflaggedItems]);
`;
code = code.replace(useEffectBlock, useEffectBlock + "\n" + unflagEffectCode);

// 5. Update logic in renderFlaggedItems
const originalLogic = `
    allSessions.forEach((session) => {
      if (session.flaggedQuestionIds && session.flaggedQuestionIds.length > 0) {
        session.questions.forEach((q) => {
          if (session.flaggedQuestionIds.includes(q.id)) {
            const topic = q.topic || "General";
            if (!flaggedByTopic[topic]) flaggedByTopic[topic] = [];
            flaggedByTopic[topic].push({ question: q, session });
          }
        });
      }
    });
`;
const modifiedLogic = `
    allSessions.forEach((session) => {
      if (session.flaggedQuestionIds && session.flaggedQuestionIds.length > 0) {
        session.questions.forEach((q) => {
          if (session.flaggedQuestionIds.includes(q.id)) {
            const isUnflagged = unflaggedItems.some((u) => u.sessionId === session.id && u.question.id === q.id);
            if (!isUnflagged) {
              const topic = q.topic || "General";
              if (!flaggedByTopic[topic]) flaggedByTopic[topic] = [];
              flaggedByTopic[topic].push({ question: q, session });
            }
          }
        });
      }
    });
`;
code = code.replace(originalLogic, modifiedLogic);

// 6. Add Unflag button in the carousel header
const topPagination = `{/* Top Pagination Controls */}
          <div className="flex gap-2">`;
const unflagButtonCode = `{/* Top Pagination Controls */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setUnflaggedItems([
                  ...unflaggedItems,
                  {
                    unflaggedAt: Date.now(),
                    question: q,
                    sessionId: session.id,
                    topic: selectedFlaggedTopic
                  }
                ]);
                if (currentFlaggedIndex >= items.length - 1) {
                  if (items.length <= 1) setSelectedFlaggedTopic(null);
                  else setCurrentFlaggedIndex(currentFlaggedIndex - 1);
                }
              }}
              className="btn-ghost flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3"
              title="Remove from Flagged Items"
            >
              <FlagOff size={16} /> <span className="font-bold text-sm hidden sm:inline">Unflag</span>
            </button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            <div className="flex gap-2">`;
code = code.replace(topPagination, unflagButtonCode);

// 7. Add Recently Unflagged section
const topicsContainerEnd = `
              ))}
            </div>
          )}
        </div>
      );
    }
`;
const recentlyUnflaggedCode = `
              ))}
            </div>
          )}
          
          {unflaggedItems.length > 0 && (
            <div className="mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-2xl font-black font-display text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                <History size={24} className="text-zinc-400" />
                Previously Flagged (Past Week)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...unflaggedItems].sort((a,b) => b.unflaggedAt - a.unflaggedAt).map((item, idx) => (
                  <div key={idx} className="app-card flex flex-col gap-4 opacity-75 hover:opacity-100 transition-all">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                        {item.topic}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                        {new Date(item.unflaggedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium line-clamp-3 text-zinc-800 dark:text-zinc-200 mb-2">
                      {item.question.stem}
                    </p>
                    <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                       <button 
                         onClick={() => {
                           setUnflaggedItems(unflaggedItems.filter(u => u !== item));
                         }}
                         className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5"
                       >
                         <Flag size={14} className="fill-current text-orange-500 opacity-70" /> Restore Flag
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
`;
code = code.replace(topicsContainerEnd, recentlyUnflaggedCode);

fs.writeFileSync('src/App.tsx', code);
console.log('unflag added');
