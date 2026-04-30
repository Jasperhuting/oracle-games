#!/usr/bin/env python3
"""
Script to find rider ID mismatches between main rankings and PCS files
"""

import re
import os

def extract_rider_info_from_html(html_content):
    """Extract rider ID, name, and points from HTML content"""
    rider_data = {}
    
    # Pattern for main rankings.html (extract data-rider-id, data-rider-name, and points)
    pattern_main = r'data-rider-id="([^"]+)" data-rider-name="([^"]+)".*?<div class="font-medium text-gray-900">(\d+)</div>'
    
    # Pattern for PCS files (extract rider URL, name, and points)
    pattern_pcs = r'<tr class=""><td>\d+</td>.*?<a href="rider/([^"]+)">([^<]+)</a>.*?<a href="rider\.php[^>]*>(\d+)</a></td></tr>'
    
    # Try main pattern first
    matches = re.findall(pattern_main, html_content, re.DOTALL)
    
    if matches:
        for match in matches:
            rider_id, rider_name, points = match
            rider_data[rider_id] = {'name': rider_name, 'points': int(points)}
    else:
        # Try PCS pattern
        matches = re.findall(pattern_pcs, html_content)
        for match in matches:
            rider_id, rider_name, points = match
            rider_data[rider_id] = {'name': rider_name, 'points': int(points)}
    
    return rider_data

def read_file_content(filepath):
    """Read content from a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"File not found: {filepath}")
        return ""
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

def main():
    base_dir = "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games/app/api/games/[gameId]/teams-overview/"
    
    # Read main rankings.html
    print("Reading main rankings.html...")
    rankings_html = read_file_content(os.path.join(base_dir, "rankings.html"))
    main_data = extract_rider_info_from_html(rankings_html)
    print(f"Extracted {len(main_data)} riders from main rankings")
    
    # Read all PCS files
    pcs_data = {}
    
    # PCS files from 1-300 (need to check what files exist)
    pcs_ranges = [
        "1-100", "101-200", "201-300"
    ]
    
    # Add the ranges we know exist
    for i in range(301, 1501, 100):
        pcs_ranges.append(f"{i}-{i+99}")
    
    print("Reading PCS ranking files...")
    for range_str in pcs_ranges:
        filename = f"rankings-pcs-{range_str}.html"
        filepath = os.path.join(base_dir, filename)
        
        if os.path.exists(filepath):
            html_content = read_file_content(filepath)
            file_data = extract_rider_info_from_html(html_content)
            pcs_data.update(file_data)
            print(f"  {filename}: {len(file_data)} riders")
        else:
            print(f"  {filename}: not found")
    
    print(f"Total PCS riders: {len(pcs_data)}")
    
    # Find riders only in main rankings
    main_only_ids = set(main_data.keys()) - set(pcs_data.keys())
    
    print(f"\n=== ANALYZING {len(main_only_ids)} RIDERS ONLY IN MAIN RANKINGS ===")
    print("=" * 80)
    
    # Group by points to see the pattern
    zero_points = []
    non_zero_points = []
    
    for rider_id in main_only_ids:
        rider_info = main_data[rider_id]
        if rider_info['points'] == 0:
            zero_points.append(rider_id)
        else:
            non_zero_points.append(rider_id)
    
    print(f"Riders with 0 points: {len(zero_points)}")
    print(f"Riders with >0 points: {len(non_zero_points)}")
    
    if non_zero_points:
        print(f"\n=== RIDERS WITH >0 POINTS ONLY IN MAIN ===")
        for rider_id in sorted(non_zero_points):
            rider_info = main_data[rider_id]
            print(f"ID: {rider_id} | Name: {rider_info['name']} | Points: {rider_info['points']}")
            
            # Try to find similar names in PCS data
            main_name = rider_info['name'].lower()
            potential_matches = []
            for pcs_id, pcs_info in pcs_data.items():
                pcs_name = pcs_info['name'].lower()
                # Check if names are very similar (same surname)
                main_surname = main_name.split()[-1] if ' ' in main_name else main_name
                pcs_surname = pcs_name.split()[-1] if ' ' in pcs_name else pcs_name
                
                if main_surname == pcs_surname:
                    potential_matches.append(f"{pcs_id} ({pcs_info['name']})")
            
            if potential_matches:
                print(f"  -> Potential PCS matches: {', '.join(potential_matches[:3])}")
            else:
                print(f"  -> No PCS name matches found")
    
    # Check if any of the zero-point riders have name matches in PCS
    print(f"\n=== CHECKING ZERO-POINT RIDERS FOR NAME MATCHES ===")
    name_matches_zero = []
    
    for rider_id in zero_points[:10]:  # Check first 10
        rider_info = main_data[rider_id]
        main_name = rider_info['name'].lower()
        
        for pcs_id, pcs_info in pcs_data.items():
            pcs_name = pcs_info['name'].lower()
            if main_name == pcs_name:
                name_matches_zero.append((rider_id, pcs_id, main_name))
                break
    
    if name_matches_zero:
        print(f"Found {len(name_matches_zero)} zero-point riders with exact name matches:")
        for main_id, pcs_id, name in name_matches_zero:
            print(f"  {name}: Main ID={main_id}, PCS ID={pcs_id}")
    else:
        print("No exact name matches found for zero-point riders (checked first 10)")

if __name__ == "__main__":
    main()
