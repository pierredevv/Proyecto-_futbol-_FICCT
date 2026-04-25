export function generateLeagueFixture(teamIds: string[], dobleVuelta = false) {
  const matches: { round: string; home_team_id: string; away_team_id: string }[] = []; 
  const list = [...teamIds];
  if (list.length % 2 !== 0) list.push(null as any);
  const fixed = list[0]; 
  const rotating = list.slice(1); 
  const totalRounds = list.length - 1;
  const rounds: { home: string; away: string }[][] = [];

  for (let r=0; r<totalRounds; r++) {
    const round: { home: string; away: string }[] = []; const current = [fixed, ...rotating];
    for (let i=0; i<current.length/2; i++) {
      const h=current[i], a=current[current.length-1-i];
      if (h && a) round.push({home:h as string, away:a as string});
    }
    rounds.push(round); rotating.unshift(rotating.pop()!);
  }

  rounds.forEach((round, idx) => round.forEach(m => matches.push({round:`Jornada ${idx+1}`, home_team_id:m.home, away_team_id:m.away})));

  if (dobleVuelta) {
    const vuelta = matches.map(m => ({...m, home_team_id:m.away_team_id, away_team_id:m.home_team_id, round:`Jornada ${parseInt(m.round.split(' ')[1])+totalRounds}`}));
    matches.push(...vuelta);
  }
  return matches;
}

export function generateKnockoutFixture(teamIds: string[]) {
  const matches: { round: string; home_team_id: string; away_team_id: string }[] = [];
  const list = [...teamIds];
  // Shuffle para que sea al azar
  list.sort(() => Math.random() - 0.5);

  const numTeams = list.length;
  // Determinamos la etapa: Final (2), Semifinal (4), Cuartos (8), Octavos (16)
  let stageName = "Eliminatoria";
  if (numTeams <= 2) stageName = "Final";
  else if (numTeams <= 4) stageName = "Semifinal";
  else if (numTeams <= 8) stageName = "Cuartos de Final";
  else if (numTeams <= 16) stageName = "Octavos de Final";

  for (let i = 0; i < list.length; i += 2) {
    if (i + 1 < list.length) {
      matches.push({
        round: stageName,
        home_team_id: list[i],
        away_team_id: list[i+1]
      });
    } else {
      // Pasa directo (bye)
      matches.push({
        round: stageName,
        home_team_id: list[i],
        away_team_id: list[i] // Dummy match para byes, o manejarlo de otra forma. Por simplicidad lo omitimos o lo marcamos como libre.
      });
    }
  }
  return matches;
}

export function generateGroupsFixture(teamIds: string[], numGroups: number = 2) {
  const list = [...teamIds];
  list.sort(() => Math.random() - 0.5);
  
  const groups: string[][] = Array.from({length: numGroups}, () => []);
  list.forEach((team, idx) => {
    groups[idx % numGroups].push(team);
  });

  const matches: { round: string; home_team_id: string; away_team_id: string }[] = [];
  
  groups.forEach((group, gIdx) => {
    const groupMatches = generateLeagueFixture(group);
    groupMatches.forEach(m => {
      matches.push({
        ...m,
        round: `Grupo ${String.fromCharCode(65 + gIdx)} - ${m.round}`
      });
    });
  });

  return matches;
}
