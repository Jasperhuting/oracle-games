export const Bike = ({ bikeColor, count }: { bikeColor: string; count: number }) => {
    return (<>
    
    <image href="/bidon.png" x={18} y={18} width={32} height={32} className="opacity-55" />
    
    <g className={`bike-${count}`}>
        <g className="wheel-1">
          <circle cx="80" cy="150" r="49" stroke="black" strokeWidth="7" fill="none" />
          <circle cx="80" cy="150" r="10" stroke="#00000050" strokeWidth="5" fill="black" />

          <path stroke="black" strokeWidth="1" d="M 30, 142 L 130, 142 M 20, 150"></path>
          <path stroke="black" strokeWidth="1" d="M 30, 158 L 130, 158 M 20, 150"></path>

          <g>
            <path stroke="black" strokeWidth="1" d="M 72 100 L 72 200 M 80 80"></path>
            <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
          </g>

          <g transform="rotate(45, 80, 150)">
            <path stroke="black" strokeWidth="1" d="M 70 100 L 70 200 M 80 80"></path>
            <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
          </g>
          <g transform="rotate(-45, 80, 150)">
            <path stroke="black" strokeWidth="1" d="M 72 100 L 72 200 M 80 80"></path>
            <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
          </g>

          <path stroke="black" strokeWidth="1" d="M 32, 130 L 128, 170"></path>
          <path stroke="black" strokeWidth="1" d="M 124, 132 L 34, 167"></path>

          <g transform="rotate(90, 80, 150)">
            <path stroke="black" strokeWidth="1" d="M 32, 130 L 128, 170"></path>
            <path stroke="black" strokeWidth="1" d="M 124, 132 L 34, 167"></path>
          </g>
        </g>

        <g transform="translate(150, 0)">
          <g className="wheel-2">
            <circle cx="80" cy="150" r="49" stroke="black" strokeWidth="7" fill="none" />
            
            <path stroke="black" strokeWidth="1" d="M 30, 142 L 130, 142 M 20, 150"></path>
            <path stroke="black" strokeWidth="1" d="M 30, 158 L 130, 158 M 20, 150"></path>

            <g>
              <path stroke="black" strokeWidth="1" d="M 72 100 L 72 200 M 80 80"></path>
              <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
            </g>

            <g transform="rotate(45, 80, 150)">
              <path stroke="black" strokeWidth="1" d="M 70 100 L 70 200 M 80 80"></path>
              <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
            </g>
            <g transform="rotate(-45, 80, 150)">
              <path stroke="black" strokeWidth="1" d="M 72 100 L 72 200 M 80 80"></path>
              <path stroke="black" strokeWidth="1" d="M 88 100 L 88 200 M 80 80"></path>
            </g>

            <path stroke="black" strokeWidth="1" d="M 32, 130 L 128, 170"></path>
            <path stroke="black" strokeWidth="1" d="M 124, 132 L 34, 167"></path>

            <g transform="rotate(90, 80, 150)">
              <path stroke="black" strokeWidth="1" d="M 32, 130 L 128, 170"></path>
              <path stroke="black" strokeWidth="1" d="M 124, 132 L 34, 167"></path>
            </g>
            <circle cx="80" cy="150" r="10" stroke="black" strokeWidth="5" fill="gray" />
          </g>
        </g>

        <path stroke={"black"} strokeLinejoin="round" strokeLinecap="round" className="steer" strokeWidth="6" fill="none" d="
  M 200 90
  L 195 80
  L 220 76
  S 230 95
    216 95
      " />




        <path stroke={bikeColor} className="bikeV" strokeLinejoin="round" strokeLinecap="round" strokeWidth="7" fill="none" d="
  M 114 70
  L 142 160
  L 200 90
      " />

        <path stroke={"black"} className="saddle" strokeLinejoin="round" strokeLinecap="round" strokeWidth="6" fill="none" d="
  M 100 67
  L 124 67
  L 110 70
  L 105 70
  Z
      " />

        <path stroke={bikeColor} className="bikeUnderLeft" strokeLinejoin="round" strokeLinecap="round" strokeWidth="6" fill="none" d="
  M 142 160
  L 79 151
      " />

        <g className="gear">
          <circle cx="142" cy="157" r="12" stroke="black" strokeWidth="2" fill="black" strokeDasharray="1, 4" strokeLinecap="square" />
          <circle cx="142" cy="157" r="11" stroke="black" strokeWidth="3" fill="none" strokeLinecap="square" />
        </g>

        <path className="chain" stroke="gray" strokeWidth="1" fill="none"
          d="
   M 155 160
    Q 154 169
    135 170
    C 70 179
    70 179
    80 170
    S 67 165
    69 150
    Q 66 128
    147 145
    S 155 145
    155 160
    Z
    "
        />


<path stroke={bikeColor} strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" fill="none" d="
  M 80 150
  L 120 100
  L 200 90
  L 230 150
      " />
        <path stroke="black" strokeLinejoin="round" strokeLinecap="round" fill="none" strokeWidth="5" className="paddle"
          d="
    M 142 158
    L 122 158
    L 122 162
    L 122 156
    L 122 158  
    L 162 158
    L 162 156
    L 162 162  
    " />


        <circle className="chanHelper" stroke="black" fill="black"
          cx="77" cy="175" r="2"
        />
        <path className="chainHelper" stroke="black" strokeLinecap="round" strokeWidth="3" fill="none"
          d="
  M 77 175
  S 87 170
   82 160
"
        />
        
        <rect className="floor" stroke="gray" strokeLinecap="round" strokeWidth="3" fill="gray"
          x="-50" y="204" width="500" height="200"
        />
        

        <g>
        <path stroke={"blue"} className="bidon" strokeLinejoin="round" fill="none" strokeLinecap="round" strokeWidth="1" d="
  M 38 50
  S 40 50
    40 48
  L 40 33
  S 39 28
    40 26
    40 20
    36 21
  L 36 20
  L 37 20
  L 37 18
  L 32 18
  L 32 20
  L 33 20
  L 33 21
  
  

  

      " />
      </g>

        <style jsx>{`

          @keyframes bikeRotation {
            0% {
              transform: rotate(0deg);
            }
            20% {
              transform: rotate(-5deg);
            }
            40% {
              transform: rotate(-6deg);
            }
            60% {
              transform: rotate(-8deg);
            }
            80% {
              transform: rotate(0deg);
            }
            90% {
              transform: rotate(4deg);
            }
            100% {
              transform: rotate(0deg);
            }
          }

          .bike-${count} {
            animation: bikeRotation 10s ease-in-out infinite;
            transform-origin: 150px 150px;
          }


          .paddle {
          transform-origin: 20px 2px;
          transform-box: fill-box;
          animation: spin 3s linear infinite;
          }


          .chain {
          animation: casinoLights 2000ms linear infinite;
          stroke-dasharray: 0, 1, 1;
          }

          .wheel-1 {
          /* Ensure rotation happens around the group's visual center inside the SVG */
          transform-origin: 60px 70px;
          transform-box: fill-box;
          animation: spin 3s linear infinite;
          }
          .wheel-2 {
          /* Ensure rotation happens around the group's visual center inside the SVG */
          transform-origin: 60px 70px;
          transform-box: fill-box;
          animation: spin 3s linear infinite;
          }
          .gear {
          transform-origin: 12px 12px;
          transform-box: fill-box;
          animation: spin 3s linear infinite;
          }
          @keyframes spin {
          to { transform: rotate(360deg); }
          }
          @keyframes casinoLights {
          from {
          stroke-dashoffset: 28;
          }
          to {
          stroke-dashoffset: 0;
          }
          }
            `}</style>

      </g></>
    )
}