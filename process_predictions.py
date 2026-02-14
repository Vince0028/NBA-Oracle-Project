import csv
import json
import os
from collections import defaultdict

# Helper to normalize stats for scores (min-max scaling)
def normalize(value, min_val, max_val):
    if max_val == min_val: return 50
    return ((value - min_val) / (max_val - min_val)) * 100

def process_csvs():
    azure_folder = 'c:/Users/Vince/Downloads/NBA-Oracle/csvnba/azure_predictions'
    csv_files = {
        'atlantic': 'atlanticpredictions.csv',
        'central': 'central-division_predictions.csv',
        'northwest': 'northwest_predictions.csv',
        'pacific': 'pacific_predictions.csv'
    }
    
    # Structure for the final JSON
    final_data = {
        "meta": {
            "model": "Azure ML Ensemble v2.1",
            "version": "2.1",
            "last_updated": "2026-02-14",
            "dataset_seasons": ["2016-17", "2017-18", "2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26"],
            "prediction_target": "2025-26"
        },
        "divisions": {}
    }

    division_teams = defaultdict(list)
    
    # Read all CSVs first to get global min/max for normalization
    all_teams_data = []

    for div_key, filename in csv_files.items():
        filepath = os.path.join(azure_folder, filename)
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}")
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
            # Map division conference
            conf = "Eastern" if div_key in ['atlantic', 'central', 'southeast'] else "Western"

            current_season_rows = [r for r in rows if r['Season_orig'] == '2025-26']
            historical_rows = [r for r in rows if r['Season_orig'] != '2025-26']

            # Group historical by team
            history_by_team = defaultdict(list)
            for h in historical_rows:
                history_by_team[h['Team_orig']].append({
                    "season": h['Season_orig'],
                    "win_pct": float(h.get('Win_Pct_orig', 0)),
                    "off_rating": float(h.get('Off_Rating_orig', 0)),
                    "def_rating": float(h.get('Def_Rating_orig', 0)),
                    "made_playoffs": int(h.get('MadePlayoffs_orig', 0)) == 1
                })

            for row in current_season_rows:
                team_name = row['Team_orig']
                # Determine playhoff status from probability
                prob_made_playoffs = float(row.get('1_predicted_proba', 0))
                # Or use the predicted binary if reliable?
                predicted_binary = int(row.get('MadePlayoffs_predicted', 0))
                
                status = "clinched" if prob_made_playoffs > 0.8 else ("eliminated" if prob_made_playoffs < 0.2 else "contender")
                
                stats = {
                    "win_pct": float(row.get('Win_Pct_orig', 0)),
                    "off_rating": float(row.get('Off_Rating_orig', 0)),
                    "def_rating": float(row.get('Def_Rating_orig', 0)),
                    "net_rating": round(float(row.get('Off_Rating_orig', 0)) - float(row.get('Def_Rating_orig', 0)), 1),
                    # Fake efficiency stats if missing
                    "efficiency_pct": float(row.get('Win_Pct_orig', 0.5)) * 0.8 # heuristic
                }

                team_obj = {
                    "team": team_name,
                    "season": "2025-26",
                    "stats": stats,
                    "playoff_status": status,
                    "historical": sorted(history_by_team[team_name], key=lambda x: x['season']),
                    "raw_prob": prob_made_playoffs
                }
                division_teams[div_key].append(team_obj)
                all_teams_data.append(team_obj)

    # Calculate normalization bounds
    if not all_teams_data:
        print("No data found!")
        return

    max_off = max(t['stats']['off_rating'] for t in all_teams_data)
    min_off = min(t['stats']['off_rating'] for t in all_teams_data)
    max_def = max(t['stats']['def_rating'] for t in all_teams_data) # Lower is better? For score, higher is better.
    min_def = min(t['stats']['def_rating'] for t in all_teams_data)
    max_win = max(t['stats']['win_pct'] for t in all_teams_data)
    min_win = min(t['stats']['win_pct'] for t in all_teams_data)

    # Process each division
    for div_key, teams in division_teams.items():
        # Sort by prediction probability (best first)
        teams.sort(key=lambda x: x['raw_prob'], reverse=True)
        
        div_analytics = {
            "strongest_team": teams[0]['team'],
            "weakest_team": teams[-1]['team'],
            "playoff_teams": sum(1 for t in teams if t['playoff_status'] == 'clinched'),
            # Calculate averages
            "average_off_rating": round(sum(t['stats']['off_rating'] for t in teams) / len(teams), 1),
            "average_def_rating": round(sum(t['stats']['def_rating'] for t in teams) / len(teams), 1),
            "average_win_pct": round(sum(t['stats']['win_pct'] for t in teams) / len(teams), 3),
        }
    
        # Find best offense/defense
        best_off = max(teams, key=lambda x: x['stats']['off_rating'])
        best_def = min(teams, key=lambda x: x['stats']['def_rating']) # Lower def rating is better defense
        div_analytics["best_offense"] = best_off['team']
        div_analytics["best_defense"] = best_def['team']

        # Add normalized scores per team
        final_teams = []
        for t in teams:
            # Normalized Score: 0-100
            # Offense: Higher is better
            off_score = normalize(t['stats']['off_rating'], min_off, max_off)
            
            # Defense: Lower is better, so invert normalization
            # (val - min) / (max - min) -> 0 is best (min). So 100 - norm.
            def_norm = normalize(t['stats']['def_rating'], min_def, max_def)
            def_score = 100 - def_norm
            
            win_score = normalize(t['stats']['win_pct'], min_win, max_win)
            
            # Weighted overall
            overall = (off_score * 0.4) + (def_score * 0.4) + (win_score * 0.2)
            
            t['normalized_scores'] = {
                "offensive_score": round(off_score, 1),
                "defensive_score": round(def_score, 1),
                "win_pct_score": round(win_score, 1),
                "overall_rating": round(overall, 1)
            }
            
            # Remove helper key
            del t['raw_prob']
            final_teams.append(t)

        final_data['divisions'][div_key] = {
            "name": f"{div_key.capitalize()} Division",
            "conference": "Eastern" if div_key in ['atlantic', 'central'] else "Western",
            "teams": final_teams,
            "division_analytics": div_analytics
        }

    # Write JSON
    output_path = 'c:/Users/Vince/Downloads/NBA-Oracle/azure_predictions.json'
    with open(output_path, 'w') as f:
        json.dump(final_data, f, indent=2)
    print(f"Successfully created {output_path}")

if __name__ == "__main__":
    process_csvs()
