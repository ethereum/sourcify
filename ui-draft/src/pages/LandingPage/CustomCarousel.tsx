import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import blockscoutSS from "../../assets/integrations/blockscout-screenshot.png";
import hardhat from "../../assets/integrations/hardhat-test.gif";

const CustomCarousel = () => {
  return (
    <Carousel infiniteLoop autoPlay interval={2000} showThumbs={false}>
      {
        // Pass an array of Elements to Carousel
        [
          <img
            src={blockscoutSS}
            className="h-96"
            style={{ width: "auto" }}
            alt="Blockscout screenshot"
          />,
          <img
            src={hardhat}
            className="h-96"
            // className="px-12 max-h-48 h-auto w-auto"
            style={{ width: "auto" }}
            alt="Hardhat verification GIF"
          />,
        ]
      }
    </Carousel>
  );
};

export default CustomCarousel;
