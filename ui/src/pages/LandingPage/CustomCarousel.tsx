import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import blockscoutSS from "../../assets/integrations/blockscout-screenshot.png";
import hardhat from "../../assets/integrations/hardhat.gif";
import otterscan from "../../assets/integrations/otterscan.png";
import remix from "../../assets/integrations/remix.gif";
import walleth from "../../assets/integrations/walleth-ss.png";
import dexGuruOptimism from "../../assets/integrations/dexGuruOptimism.png";

const CustomCarousel = () => {
  return (
    <Carousel
      infiniteLoop
      autoPlay
      interval={5000}
      showThumbs={false}
      showStatus={false}
    >
      {
        // Pass an array of Elements to Carousel
        [
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-blockscout"
          >
            <img
              src={blockscoutSS}
              // className="md:h-[30rem]"
              style={{ width: "auto" }}
              alt="Blockscout screenshot"
            />
          </div>,
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-hardhat"
          >
            <img
              src={hardhat}
              // className="md:h-[30rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Hardhat verification GIF"
            />
          </div>,
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-remix"
          >
            <img
              src={remix}
              // className="md:h-[24rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Remix verification GIF"
            />
          </div>,
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-otterscan"
          >
            <img
              src={otterscan}
              // className="md:h-[24rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Otterscan Verified by Sourcify"
            />
          </div>,
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-walleth"
          >
            <img
              src={walleth}
              // className="md:h-[24rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Walleth Verified by Sourcify"
            />
          </div>,
          <div
            className="flex justify-center items-center w-full h-full"
            key="carousel-walleth"
          >
            <img
              src={dexGuruOptimism}
              // className="md:h-[24rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="DexGuru Block Explorer Contract Verify by Sourcify"
            />
          </div>,
        ]
      }
    </Carousel>
  );
};

export default CustomCarousel;
