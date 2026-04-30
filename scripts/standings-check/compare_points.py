#!/usr/bin/env python3
"""
Script to extract and compare points data between rankings.html and PCS ranking files
"""

import re
import os

def extract_points_from_html(html_content):
    """Extract rider ID and points from HTML content"""
    points_data = {}
    
    # Pattern for main rankings.html (extract data-rider-id and points)
    pattern_main = r'data-rider-id="([^"]+)".*?<div class="font-medium text-gray-900">(\d+)</div>'
    
    # Pattern for PCS files (extract rider URL and points)
    pattern_pcs = r'<tr class=""><td>\d+</td>.*?<a href="rider/([^"]+)">[^<]+</a>.*?<a href="rider\.php[^>]*>(\d+)</a></td></tr>'
    
    # Try main pattern first
    matches = re.findall(pattern_main, html_content, re.DOTALL)
    
    if matches:
        for match in matches:
            rider_id, points = match
            points_data[rider_id] = int(points)
    else:
        # Try PCS pattern
        matches = re.findall(pattern_pcs, html_content)
        for match in matches:
            rider_id, points = match
            points_data[rider_id] = int(points)
    
    return points_data

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
    main_points = extract_points_from_html(rankings_html)
    print(f"Extracted {len(main_points)} riders from main rankings")
    
    # Read all PCS files
    pcs_points = {}
    
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
            file_points = extract_points_from_html(html_content)
            pcs_points.update(file_points)
            print(f"  {filename}: {len(file_points)} riders")
        else:
            print(f"  {filename}: not found")
    
    print(f"Total PCS riders: {len(pcs_points)}")
    
    # Compare the data
    print("\nComparing points data...")
    
    discrepancies = []
    
    # Check riders in main rankings but not in PCS
    for rider_id, main_pts in main_points.items():
        if rider_id in pcs_points:
            pcs_pts = pcs_points[rider_id]
            if main_pts != pcs_pts:
                diff = main_pts - pcs_pts
                discrepancies.append(f"ID: {rider_id} | Main: {main_pts} | PCS: {pcs_pts} | DIFF: {diff}")
        else:
            # Only include if main points > 0
            if main_pts > 0:
                discrepancies.append(f"ID: {rider_id} | Main: {main_pts} | PCS: NOT FOUND | DIFF: {main_pts}")
    
    # Check riders in PCS but not in main
    # Skip these as they're not relevant for the discrepancies file
    # for rider_id, pcs_pts in pcs_points.items():
    #     if rider_id not in main_points:
    #         # Only include if PCS points > 0
    #         if pcs_pts > 0:
    #             discrepancies.append(f"ID: {rider_id} | Main: NOT FOUND | PCS: {pcs_pts} | DIFF: -{pcs_pts}")
    
    # Write discrepancies to file
    output_file = os.path.join(base_dir, "points_discrepancies.txt")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("POINTS DISCREPANCIES BETWEEN MAIN RANKINGS AND PCS RANKINGS\n")
        f.write("=" * 80 + "\n\n")
        
        if discrepancies:
            f.write(f"Found {len(discrepancies)} discrepancies:\n\n")
            for discrepancy in discrepancies:
                f.write(discrepancy + "\n")
        else:
            f.write("No discrepancies found! All rider points match perfectly.\n")
    
    print(f"\nDiscrepancies written to: {output_file}")
    print(f"Total discrepancies: {len(discrepancies)}")
    
    # Show some statistics
    print(f"\nStatistics:")
    print(f"  Main rankings riders: {len(main_points)}")
    print(f"  PCS rankings riders: {len(pcs_points)}")
    print(f"  Matching riders: {len(set(main_points.keys()) & set(pcs_points.keys()))}")
    print(f"  Only in main: {len(set(main_points.keys()) - set(pcs_points.keys()))}")
    print(f"  Only in PCS: {len(set(pcs_points.keys()) - set(main_points.keys()))}")

if __name__ == "__main__":
    main()
