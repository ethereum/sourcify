import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import blockscoutSS from "../../assets/integrations/blockscout-screenshot.png";
import hardhat from "../../assets/integrations/hardhat.gif";
import remix from "../../assets/integrations/remix.gif";

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
          <div className="flex justify-center items-center w-full h-full">
            <img
              src={blockscoutSS}
              // className="md:h-[30rem]"
              style={{ width: "auto" }}
              alt="Blockscout screenshot"
            />
          </div>,
          <div className="flex justify-center items-center w-full h-full">
            <img
              src={hardhat}
              // className="md:h-[30rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Hardhat verification GIF"
            />
          </div>,
          <div className="flex justify-center items-center w-full h-full">
            <img
              src={remix}
              // className="md:h-[24rem]"
              // className="px-12 max-h-48 h-auto w-auto"
              style={{ width: "auto" }}
              alt="Remix verification GIF"
            />
          </div>,
        ]
      }
    </Carousel>
  );
};

export default CustomCarousel;
